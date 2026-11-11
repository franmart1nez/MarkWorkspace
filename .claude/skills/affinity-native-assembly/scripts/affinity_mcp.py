"""Access Affinity's native local MCP without the Computer Use bridge.

Uses Python's standard library only. Runtime receipts and SDK text are stored
under ignored .mrmak/affinity/ by default; --state-dir separates project state.
Tool calls are submitted once; an unknown result is never retried automatically.
"""

import argparse
from datetime import datetime, timezone
import http.client
import json
from pathlib import Path
import threading
import time
from urllib.parse import urlsplit
import uuid

WORKSPACE = Path(__file__).resolve().parents[4]
STATE = WORKSPACE / '.mrmak/affinity'
STATUS_SCRIPT = (
    "const { Application } = require('/application.js'); "
    "console.log(JSON.stringify({application: Application.productShortName, "
    "version: Application.version, openDocumentCount: Application.documents.all.length, "
    "hasCurrentDocument: Application.documents.current !== null}));"
)


class AffinityClient:
    def __init__(self, timeout=90, state_dir=STATE):
        self.timeout = timeout
        self.state_dir = Path(state_dir).resolve()
        self.endpoint = None
        self.responses = {}
        self.ready = threading.Event()
        self.condition = threading.Condition()
        self.counter = 0
        self.failure = None
        self.stream_connection = None
        threading.Thread(target=self._read, daemon=True).start()
        if not self.ready.wait(8):
            raise TimeoutError('Affinity did not provide its local SSE endpoint.')
        if self.failure:
            raise RuntimeError(self.failure)

    def _read(self):
        try:
            self.stream_connection = http.client.HTTPConnection('::1', 6767, timeout=self.timeout + 10)
            self.stream_connection.request('GET', '/sse', headers={'Accept': 'text/event-stream'})
            response = self.stream_connection.getresponse()
            if response.status != 200:
                raise RuntimeError(f'Affinity SSE returned HTTP {response.status}.')
            kind, data = None, []
            while True:
                raw = response.readline()
                if not raw:
                    raise ConnectionError('Affinity closed the MCP stream; check the outcome before resubmitting.')
                line = raw.decode('utf-8').rstrip('\r\n')
                if not line:
                    value = '\n'.join(data)
                    if kind == 'endpoint':
                        parsed = urlsplit(value)
                        if parsed.hostname and parsed.hostname not in ('::1', 'localhost', '127.0.0.1'):
                            raise ValueError('Refusing a non-loopback endpoint.')
                        if parsed.port is not None and parsed.port != 6767:
                            raise ValueError('Refusing an unexpected local port.')
                        if not parsed.path.startswith('/'):
                            raise ValueError('Affinity returned an invalid local endpoint.')
                        self.endpoint = parsed.path + ('?' + parsed.query if parsed.query else '')
                        self.ready.set()
                    elif value:
                        packet = json.loads(value)
                        # Some native streams emit scalar progress/keepalive values.
                        # Only JSON-RPC object messages can carry response IDs.
                        if isinstance(packet, dict) and 'id' in packet:
                            with self.condition:
                                self.responses[packet['id']] = packet
                                self.condition.notify_all()
                    kind, data = None, []
                elif line.startswith('event:'):
                    kind = line[6:].strip()
                elif line.startswith('data:'):
                    data.append(line[5:].lstrip())
        except Exception as error:
            self.failure = f'{type(error).__name__}: {error}'
            self.ready.set()
            with self.condition:
                self.condition.notify_all()

    def request(self, method, params=None, notification=False):
        self.counter += 1
        packet = {'jsonrpc': '2.0', 'method': method}
        if not notification:
            packet['id'] = self.counter
        if params is not None:
            packet['params'] = params
        connection = http.client.HTTPConnection('::1', 6767, timeout=10)
        try:
            connection.request('POST', self.endpoint, body=json.dumps(packet), headers={'Content-Type': 'application/json'})
            response = connection.getresponse()
            response.read()
            if response.status not in (200, 202, 204):
                raise RuntimeError(f'Affinity MCP POST returned HTTP {response.status}.')
        finally:
            connection.close()
        if notification:
            return None
        deadline = time.monotonic() + self.timeout
        with self.condition:
            while packet['id'] not in self.responses:
                if self.failure:
                    raise RuntimeError(self.failure)
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError(f'{method} timed out; verify its outcome before submitting again.')
                self.condition.wait(remaining)
            response = self.responses.pop(packet['id'])
        if 'error' in response:
            raise RuntimeError(json.dumps(response['error']))
        return response['result']

    def initialize(self):
        result = self.request('initialize', {'protocolVersion': '2025-11-25', 'capabilities': {},
            'clientInfo': {'name': 'workspace-affinity-client', 'version': '1.0.0'}})
        self.request('notifications/initialized', notification=True)
        return result

    def tool(self, name, arguments):
        return self.request('tools/call', {'name': name, 'arguments': arguments})

    def documentation(self, filename):
        result = self.tool('read_sdk_documentation_topic', {'filename': filename})
        if result.get('isError'):
            raise RuntimeError(f'Affinity could not read SDK topic {filename}.')
        folder = self.state_dir / 'affinity-sdk-live'
        folder.mkdir(parents=True, exist_ok=True)
        safe_name = filename.replace('/', '_').replace('\\', '_')
        (folder / (safe_name + '.json')).write_text(json.dumps(result, indent=2), encoding='utf-8')
        return result

    def close(self):
        if self.stream_connection:
            self.stream_connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('catalog', 'docs', 'status', 'call'))
    parser.add_argument('target', nargs='?')
    parser.add_argument('--arguments-file', type=Path)
    parser.add_argument('--sdk-topic', action='append', default=[])
    parser.add_argument('--state-dir', type=Path, default=STATE,
        help='Private runtime receipt/SDK directory (default: workspace .mrmak/affinity).')
    args = parser.parse_args()
    if args.command == 'call' and not args.target:
        parser.error('Specify an exact live tool name and, when needed, --arguments-file.')
    arguments = json.loads(args.arguments_file.read_text('utf-8-sig')) if args.arguments_file else {}
    if not isinstance(arguments, dict):
        parser.error('The arguments file must contain one JSON object.')

    client = AffinityClient(state_dir=args.state_dir)
    try:
        initialization = client.initialize()
        catalog = client.request('tools/list')
        tools = catalog.get('tools', [])
        if args.command == 'catalog':
            print(json.dumps({'serverInfo': initialization.get('serverInfo'), 'tools': tools}, indent=2))
            return

        # The gate is per live connection, including after an app restart.
        preamble = client.documentation('preamble')
        if args.command == 'docs':
            result = preamble if args.target in (None, 'preamble') else client.documentation(args.target)
            for block in result.get('content', []):
                if block.get('type') == 'text':
                    print(block['text'])
            return

        tool = 'execute_script' if args.command == 'status' else args.target
        if tool not in {entry['name'] for entry in tools}:
            raise ValueError('Requested tool is absent from the live Affinity catalog.')
        if args.command == 'status':
            arguments = {'script': STATUS_SCRIPT}
        topics = ['application.js', 'document.js'] if tool == 'execute_script' else []
        for filename in dict.fromkeys(topics + args.sdk_topic):
            client.documentation(filename)

        folder = args.state_dir.resolve() / 'jobs'
        folder.mkdir(parents=True, exist_ok=True)
        receipt = folder / ('affinity-' + uuid.uuid4().hex + '.json')
        record = {'startedAt': datetime.now(timezone.utc).isoformat(), 'tool': tool,
            'arguments': arguments, 'status': 'submitted-once; verify-outcome-before-replacement'}
        receipt.write_text(json.dumps(record, indent=2), encoding='utf-8')
        try:
            result = client.tool(tool, arguments)
        except Exception as error:
            record.update(status='outcome-unknown-do-not-repeat-blindly', error=str(error))
            receipt.write_text(json.dumps(record, indent=2), encoding='utf-8')
            raise RuntimeError(f'Call did not complete normally. Inspect the local receipt: {receipt}') from error
        record.update(status='tool-error' if result.get('isError') else 'completed', result=result)
        receipt.write_text(json.dumps(record, indent=2), encoding='utf-8')
        if args.command == 'status':
            print(json.dumps(result, indent=2))
        else:
            print(json.dumps({'tool': tool, 'isError': result.get('isError', False), 'receipt': str(receipt)}))
    finally:
        client.close()


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, TimeoutError) as error:
        raise SystemExit(str(error)) from None

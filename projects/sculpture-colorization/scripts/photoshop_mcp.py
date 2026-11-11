"""Use the local Photoshop MCP without restarting an active agent session."""

import argparse
import asyncio
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


ROOT = Path(__file__).resolve().parents[3]
SERVER = Path(__file__).with_name('photoshop_server.py')
PRIVATE = ROOT / '.mrmak/photoshop-mcp'


def tool_failed(result):
    if result.get('isError'):
        return True
    payloads = [result.get('structuredContent')]
    for block in result.get('content', []):
        if block.get('type') == 'text':
            try:
                payloads.append(json.loads(block['text']))
            except (ValueError, KeyError):
                pass
    return any(isinstance(payload, dict) and payload.get('success') is False for payload in payloads)


async def run(args):
    params = StdioServerParameters(command=sys.executable, args=[str(SERVER)], cwd=str(ROOT))
    PRIVATE.mkdir(parents=True, exist_ok=True)
    with (PRIVATE / 'server.log').open('a', encoding='utf-8') as log:
        async with stdio_client(params, errlog=log) as (read, write):
            async with ClientSession(read, write, read_timeout_seconds=timedelta(seconds=180)) as session:
                initialized = await session.initialize()
                if args.command == 'catalog':
                    result = (await session.list_tools()).model_dump(mode='json')
                    result['instructions'] = initialized.instructions
                else:
                    if args.command == 'status':
                        name, arguments = 'photoshop_connection_status', {}
                    elif args.command == 'documents':
                        name, arguments = 'photoshop_inspect_documents', {}
                    else:
                        name = args.tool
                        arguments = json.loads(args.arguments_file.read_text('utf-8')) if args.arguments_file else {}
                    result = (await session.call_tool(name, arguments)).model_dump(mode='json')
    if args.command in {'status', 'catalog'}:
        print(json.dumps(result, indent=2, ensure_ascii=True))
    else:
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        receipt = PRIVATE / f'{stamp}-{args.command}.json'
        receipt.write_text(json.dumps(result, indent=2, ensure_ascii=True) + '\n', encoding='utf-8')
        print(json.dumps({'receipt': str(receipt), 'isError': tool_failed(result)}))
    return tool_failed(result)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['status', 'catalog', 'documents', 'call'])
    parser.add_argument('tool', nargs='?')
    parser.add_argument('--arguments-file', type=Path)
    args = parser.parse_args()
    if args.command == 'call' and not args.tool:
        parser.error('Specify the tool name; inspect catalog before using it.')
    if asyncio.run(run(args)):
        raise SystemExit(1)


if __name__ == '__main__':
    main()

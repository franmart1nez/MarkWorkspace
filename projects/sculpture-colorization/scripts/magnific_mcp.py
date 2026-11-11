"""Call the official Magnific MCP through the installed Codex OAuth client.

Uses only MCP protocol requests; never starts a model turn. This keeps an
already-running chat usable before its native tool catalog is refreshed.
Credentials stay in Codex secure storage. Results stay in ignored local state.
"""

import argparse
import json
from pathlib import Path
import queue
import shutil
import subprocess
import threading
import time
import tomllib
import uuid


ROOT = Path(__file__).resolve().parents[3]
LOCAL = ROOT / ".mrmak" / "sculpture-colorization"


class MagnificClient:
    def __init__(self, timeout):
        self.timeout = timeout
        self.sequence = 0
        self.messages = queue.Queue()
        executable = shutil.which("codex")
        if not executable:
            raise RuntimeError("Codex CLI is not installed or is missing from PATH.")
        configuration = tomllib.loads((ROOT / ".codex/config.toml").read_text("utf-8"))
        server = configuration["mcp_servers"]["magnific"]
        if server.get("enabled", True) is False:
            raise RuntimeError("The project's Magnific connection is disabled.")
        if server["url"] != "https://mcp.magnific.com":
            raise RuntimeError("Expected the configured official Magnific endpoint.")
        # App-server inventory without a thread uses user-level configuration.
        # Supply the project connection to this process without changing it globally.
        overrides = [
            "mcp_servers.magnific.url=" + json.dumps(server["url"]),
            "mcp_servers.magnific.startup_timeout_sec=" + str(server.get("startup_timeout_sec", 30)),
            "mcp_servers.magnific.tool_timeout_sec=" + str(server.get("tool_timeout_sec", 180)),
        ]
        command = [executable, "app-server", "--stdio"]
        for override in overrides:
            command.extend(["-c", override])
        self.process = subprocess.Popen(
            command, cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        try:
            for line in self.process.stdout:
                try:
                    self.messages.put(json.loads(line))
                except (ValueError, UnicodeDecodeError):
                    continue
        finally:
            self.messages.put(None)

    def send(self, message):
        self.process.stdin.write((json.dumps(message) + "\n").encode("utf-8"))
        self.process.stdin.flush()

    def request(self, method, params):
        self.sequence += 1
        request_id = self.sequence
        self.send({"id": request_id, "method": method, "params": params})
        deadline = time.monotonic() + self.timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("MCP request timed out. Check the existing provider job before retrying.")
            try:
                message = self.messages.get(timeout=remaining)
            except queue.Empty:
                raise TimeoutError("MCP request timed out. Check the existing provider job before retrying.") from None
            if message is None:
                raise RuntimeError("The Codex MCP client exited before returning a result.")
            if message.get("id") == request_id:
                if "error" in message:
                    raise RuntimeError(message["error"].get("message", "MCP request failed."))
                return message["result"]
            if "method" in message and "id" in message:
                raise RuntimeError("This tool requires interactive client input. Use the native MCP interface.")

    def initialize(self):
        self.request("initialize", {
            "clientInfo": {"name": "sculpture_colorization_mcp", "version": "1.0.0"},
            "capabilities": {"experimentalApi": True},
        })
        self.send({"method": "initialized", "params": {}})

    def close(self):
        if self.process.stdin:
            try:
                self.process.stdin.close()
            except OSError:
                pass
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            # This is our disposable protocol client, never an active agent session.
            self.process.terminate()
            self.process.wait(timeout=5)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout", type=int, default=240)
    commands = parser.add_subparsers(dest="command", required=True)
    catalog = commands.add_parser("catalog", help="Discover the live tools or inspect one schema.")
    catalog.add_argument("--tool")
    call = commands.add_parser("call", help="Call one tool using its verified live schema.")
    call.add_argument("tool")
    call.add_argument("--arguments-file", type=Path)
    args = parser.parse_args()
    LOCAL.mkdir(parents=True, exist_ok=True)
    client = MagnificClient(args.timeout)
    try:
        client.initialize()
        inventory = client.request("mcpServerStatus/list", {"serverName": "magnific", "limit": 10})
        server = next((item for item in inventory["data"] if item["name"] == "magnific"), None)
        if not server or server.get("toolsError") or not server.get("tools"):
            reason = server.get("toolsError") if server else "No Magnific server was discovered."
            auth = server.get("authStatus", "unknown") if server else "unknown"
            if reason and "token expired" in reason.lower():
                raise RuntimeError("Magnific login expired. Run 'codex mcp login magnific', then resume the same project.")
            raise RuntimeError(f"Magnific tool discovery failed (auth: {auth}). {reason or 'No tools returned.'}")
        (LOCAL / "tool-catalog.json").write_text(json.dumps(server, indent=2), "utf-8")
        if args.command == "catalog":
            result = server["tools"][args.tool] if args.tool else {
                "server": "magnific", "authStatus": server["authStatus"],
                "toolCount": len(server["tools"]), "tools": sorted(server["tools"]),
            }
            print(json.dumps(result, indent=2))
            return
        if args.tool not in server["tools"]:
            raise RuntimeError("The requested tool is not in Magnific's live catalog.")
        arguments = json.loads(args.arguments_file.read_text("utf-8-sig")) if args.arguments_file else {}
        if not isinstance(arguments, dict):
            raise ValueError("Tool arguments must be a JSON object.")
        # An ephemeral context supplies MCP connection state. No turn/start call
        # is issued, so this does not run or delegate work to another AI agent.
        context = client.request("thread/start", {"cwd": str(ROOT), "ephemeral": True})
        result = client.request("mcpServer/tool/call", {
            "threadId": context["thread"]["id"], "server": "magnific",
            "tool": args.tool, "arguments": arguments,
        })
        receipts = LOCAL / "jobs"
        receipts.mkdir(exist_ok=True)
        receipt = receipts / (time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:8] + ".json")
        receipt.write_text(json.dumps({"tool": args.tool, "arguments": arguments, "result": result}, indent=2), "utf-8")
        # Tool results can contain private account data and signed download URLs.
        # Save them locally; keep normal terminal output limited to this receipt.
        print(json.dumps({"tool": args.tool, "isError": bool(result.get("isError")), "receipt": str(receipt)}))
        if result.get("isError"):
            raise SystemExit(1)
    finally:
        client.close()


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError, TimeoutError, KeyError) as error:
        raise SystemExit(str(error)) from None

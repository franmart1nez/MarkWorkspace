# Optional Magnific connection

The official remote MCP endpoint is `https://mcp.magnific.com`. It uses Streamable HTTP and Magnific OAuth; credentials belong in the client's secure login storage. No local server package or API key is required. See the [Magnific connection documentation](https://docs.magnific.com/modelcontextprotocol).

The connection is scoped to this trusted repository in `.codex/config.toml`:

```toml
[mcp_servers.magnific]
url = "https://mcp.magnific.com"
enabled = true
startup_timeout_sec = 30
tool_timeout_sec = 180
```

## Authenticate

Run these commands from the repository root:

```powershell
codex mcp get magnific
codex mcp login magnific
```

Complete the browser sign-in and grant the requested account access. The terminal should confirm a successful login. This is separate from merely registering the endpoint. Never paste passwords, OAuth callback URLs or access tokens into project documents.

## Verify from the chat

Inspect the chat's MCP connection list, then perform a read-only tool discovery or credit-balance check. A registered endpoint, a successful login and tools loaded into the current chat are three separate checks. Do not claim the integration works in a running chat until a live tool call succeeds.

If a running chat has not loaded the new definition, use its supported MCP refresh action if available, or open a new chat in this repository. Preserve the active session. Ask the user before any application restart, as required by the repository instructions.

### Access from the current chat

The included local client lets the agent use Magnific from this conversation without restarting. It uses the installed Codex client's secure OAuth storage and the official MCP, and runs no model turn or delegated agent. Native tools can be used directly once the chat loads the connection.

From the repository root:

```powershell
python projects/sculpture-colorization/scripts/magnific_mcp.py catalog --tool images_generate
python projects/sculpture-colorization/scripts/magnific_mcp.py call images_models_list
```

For tools with arguments, write the exact argument object to a local JSON file and pass `--arguments-file <path>`. Inspect the live schema first. Paid image calls still require the user's production request and credit limit.

Calls save their complete results under `.mrmak/sculpture-colorization/jobs/` and print only the receipt location and error flag. This keeps signed URLs and private response data out of normal terminal output. Consult that receipt to recover an existing job after an interruption; the client never automatically retries a submission.

### Another local AI client

The project includes agent-neutral `START_HERE.md` and `NEXT_SESSION.md` files and a `CLAUDE.md` entry point. Another agent with filesystem/terminal access under the same Windows account can execute the Python protocol client even if its own native MCP catalog has no Magnific connection. That path still requires the installed Codex executable and a live Codex-managed Magnific OAuth session; it does not invoke a Codex model.

Authentication can expire. If live discovery reports `Token expired`, run `codex mcp login magnific`, complete the browser authorization, then repeat read-only discovery. Do not recreate the sculpture or resubmit a paid job to resolve a login failure. Native configuration for a different AI client remains separate; no additional client connections were installed by this audit.

For Codex configuration and OAuth behavior, see the [official MCP guide](https://developers.openai.com/codex/mcp/). The installed CLI's `codex mcp --help` is the local command reference.

## Production sequence when Magnific is explicitly requested

Apply [GENERATION_POLICY.md](GENERATION_POLICY.md) and [DIRECTIVES.md](DIRECTIVES.md). Confirm the requested Magnific operation's live schema and budget within that explicit production scope. No automatic provider switch is configured. Preserve sources/reference roles and resolve any existing job before replacement.

The finished-01 reference, direct crop production for all remaining views, batch review and sequential Photoshop assembly sequence still applies. Keep OAuth data in secure login storage and job/upload receipts under ignored `.mrmak/sculpture-colorization/jobs/`.

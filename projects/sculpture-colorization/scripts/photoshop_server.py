"""Project-local launcher for the pinned Photoshop MCP's native JSX tool.

Attach to an existing application only. Discovery never starts Photoshop,
creates a document, or retries a possibly partially executed script.
"""

import json
from importlib.metadata import version

from mcp.server.fastmcp import FastMCP
from photoshop_mcp_server.logging_config import configure_root_logging
from photoshop_mcp_server.tools import script_tools


INSTRUCTIONS = (
    "Sculpture montage in Photoshop. Read project DIRECTIVES.md and "
    "PHOTOSHOP_INTEGRATION.md. Composite 01 is supplied finished. Complete and "
    "review all target views' generated crops before montage. Ask the user to "
    "open Photoshop if closed; this bridge never launches it. Inspect documents "
    "and verify the exact target before edits. Assemble one view at a time in a "
    "versioned PSD/PSB with editable masks. No color/lighting corrections. "
    "Scripts execute once; inspect state after an error before retrying."
)

# ExtendScript uses ES3. Include escaping of control characters and Windows paths.
JSON_POLYFILL = r'''
if (typeof JSON === 'undefined') { JSON = {}; }
if (!JSON.stringify) { JSON.stringify = function(v) {
    function quote(s) { return '"' + s.replace(/[\\"\u0000-\u001f]/g, function(c) {
        var h = c.charCodeAt(0).toString(16);
        return '\\u' + ('0000' + h).slice(-4);
    }) + '"'; }
    if (v === null || typeof v === 'undefined') return 'null';
    if (typeof v === 'string') return quote(v);
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    var a = [], k;
    if (v instanceof Array) {
        for (k = 0; k < v.length; k++) a.push(JSON.stringify(v[k]));
        return '[' + a.join(',') + ']';
    }
    for (k in v) if (v.hasOwnProperty(k)) a.push(quote(k) + ':' + JSON.stringify(v[k]));
    return '{' + a.join(',') + '}';
}; }
'''

DOCUMENTS_JSX = r'''
(function() {
    function layers(items) {
        var out = [], i, l;
        for (i = 0; i < items.length; i++) {
            l = items[i];
            var item = {name:l.name, type:l.typename, visible:l.visible};
            try { item.id = l.id; } catch(e) {}
            if (l.typename === 'LayerSet') item.children = layers(l.layers);
            out.push(item);
        }
        return out;
    }
    var out = [], i, d;
    for (i = 0; i < app.documents.length; i++) {
        d = app.documents[i];
        var item = {id:d.id, name:d.name, width:d.width.as('px'),
            height:d.height.as('px'), resolution:d.resolution,
            bitDepth:String(d.bitsPerChannel), mode:String(d.mode), saved:d.saved,
            active:d === app.activeDocument, layers:layers(d.layers)};
        try { item.path = d.fullName.fsName; } catch(e) { item.path = null; }
        try { item.colorProfile = d.colorProfileName; } catch(e) { item.colorProfile = null; }
        out.push(item);
    }
    return JSON.stringify({version:app.version, documents:out});
})();
'''


def with_application(action):
    """Use a COM apartment belonging to this call; never retain a cross-thread pointer."""
    import comtypes
    from comtypes.client import GetActiveObject

    comtypes.CoInitialize()
    try:
        application = GetActiveObject('Photoshop.Application', dynamic=True)
        return action(application)
    finally:
        comtypes.CoUninitialize()


class ExistingPhotoshop:
    """Adapter used by upstream script_tools instead of its new-document session."""

    def execute_javascript(self, script):
        # One COM submission only. An error may follow partial document changes.
        full_script = JSON_POLYFILL + '\n' + script
        return with_application(lambda app: app.DoJavaScript(full_script, None, 1))


def create_server():
    configure_root_logging()
    server = FastMCP('MarkWorkspace Photoshop', instructions=INSTRUCTIONS)

    @server.tool(name='photoshop_connection_status')
    def connection_status() -> dict:
        """Read-only existing-instance check. Never launch Photoshop or create a document."""
        result = {'serverVersion': version('photoshop-mcp-server'), 'launchesApplication': False}
        try:
            result.update(with_application(lambda app: {
                'running': True, 'version': str(app.Version),
                'documentCount': int(app.Documents.Count),
            }))
        except Exception as error:
            result.update(running=False, reason=str(error),
                          nextAction='After all generated crops pass review, ask the user to open Photoshop.')
        return result

    @server.tool(name='photoshop_inspect_documents')
    def inspect_documents() -> dict:
        """Read-only document IDs, paths, dimensions, depth/profile and layer tree."""
        try:
            return {'success': True, 'result': json.loads(ExistingPhotoshop().execute_javascript(DOCUMENTS_JSX))}
        except Exception as error:
            return {'success': False, 'error': str(error)}

    # Keep the upstream native JSX tool/schema and error propagation. Replace
    # only its adapter so that it cannot auto-launch/create or retry a write.
    script_tools.PhotoshopApp = ExistingPhotoshop
    script_tools.register(server)
    return server


if __name__ == '__main__':
    create_server().run(transport='stdio')

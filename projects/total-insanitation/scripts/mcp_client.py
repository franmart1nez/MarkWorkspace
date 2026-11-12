"""Inspect/call the configured native MCPs without restarting an agent session.

Use --server blender|unreal [--tool NAME --arguments FILE] [--output FILE].
Omitting --tool discovers schemas. Tool calls remain sequential.
Runtime output belongs under .mrmak/total-insanitation/.
"""
import argparse
import asyncio
import base64
from contextlib import AsyncExitStack
import json
import os
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.streamable_http import streamable_http_client

ROOT = Path(__file__).resolve().parents[3]
LOCAL = ROOT / '.mrmak/total-insanitation'
BLENDER = 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe'

async def run(args):
    arguments = json.loads(Path(args.arguments).read_text(encoding='utf-8')) if args.arguments else {}
    async with AsyncExitStack() as stack:
        if args.server == 'blender':
            env = {**os.environ, 'BLENDER_PATH': BLENDER,
                   'BLENDER_MCP_HOST': '127.0.0.1', 'BLENDER_MCP_PORT': '9876'}
            streams = await stack.enter_async_context(stdio_client(StdioServerParameters(
                command=str(LOCAL / 'venv/Scripts/python.exe'), args=['-m', 'blmcp'],
                env=env, cwd=str(ROOT))))
        else:
            streams = await stack.enter_async_context(streamable_http_client('http://127.0.0.1:8000/mcp'))
        session = await stack.enter_async_context(ClientSession(streams[0], streams[1]))
        initialized = await session.initialize()
        if args.tool:
            response = await session.call_tool(args.tool, arguments)
        else:
            response = await session.list_tools()
        data = response.model_dump(mode='json', exclude_none=True)
        if args.output:
            target = Path(args.output)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(data, indent=2), encoding='utf-8')
            for index, content in enumerate(data.get('content', [])):
                if content.get('type') == 'image':
                    image = target.with_name(target.stem + '-' + str(index) + '.png')
                    image.write_bytes(base64.b64decode(content['data']))
                elif content.get('type') == 'text':
                    # Epic returns images inside the JSON text result.
                    try:
                        nested = json.loads(content['text'])
                    except json.JSONDecodeError:
                        continue
                    def extract_images(value):
                        if isinstance(value, dict):
                            if value.get('mimeType', '').startswith('image/') and value.get('data'):
                                image = target.with_name(target.stem + '-' + str(index) + '.png')
                                image.write_bytes(base64.b64decode(value['data']))
                            for child in value.values():
                                extract_images(child)
                        elif isinstance(value, list):
                            for child in value:
                                extract_images(child)
                    extract_images(nested)
            print(json.dumps({'server': initialized.serverInfo.model_dump(),
                              'output': str(target), 'isError': data.get('isError', False),
                              'tools': [t['name'] for t in data.get('tools', [])]}))
        else:
            print(json.dumps(data, indent=2))
        return 1 if data.get('isError', False) else 0

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server', required=True, choices=['blender', 'unreal'])
    parser.add_argument('--tool')
    parser.add_argument('--arguments')
    parser.add_argument('--output')
    raise SystemExit(asyncio.run(run(parser.parse_args())))

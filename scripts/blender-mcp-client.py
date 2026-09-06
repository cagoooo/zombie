"""Run a real MCP stdio session against the locally installed Blender MCP server."""
import asyncio, base64, json, os, argparse
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--code', type=Path)
    parser.add_argument('--screenshot', type=Path)
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    exe=Path.home()/'.local/share/blender-mcp/source/.venv/Scripts/blender-mcp.exe'
    env={**os.environ, 'DISABLE_TELEMETRY':'true', 'BLENDER_HOST':'127.0.0.1',
         'BLENDER_PORT':'9876', 'BLENDER_MCP_SAFE_MODE':'true'}
    params=StdioServerParameters(command=str(exe),args=[],env=env)
    report={}
    with (root/'artifacts/blender-mcp-client.log').open('w',encoding='utf-8') as log:
        async with stdio_client(params,errlog=log) as (read,write):
            async with ClientSession(read,write) as session:
                init=await session.initialize()
                report['server']=init.serverInfo.model_dump()
                listing=await session.list_tools()
                report['tools']=[tool.name for tool in listing.tools]
                for name, values in [('get_scene_info',{}),
                    *([('execute_blender_code',{'code':args.code.read_text(encoding='utf-8').replace('H:/zombie',root.as_posix())})] if args.code else []),
                    *([('get_scene_info',{})] if args.code else [])]:
                    result=await session.call_tool(name,{**values,'user_prompt':'安裝並使用 Blender MCP，驗證遊戲素材場景操作。'})
                    texts=[block.text for block in result.content if block.type=='text']
                    report.setdefault('calls',[]).append({'tool':name,'error':result.isError,'text':texts})
                    if result.isError or any(text.startswith(('Error','Rejected')) for text in texts):
                        raise RuntimeError(str(texts))
                if args.screenshot:
                    result=await session.call_tool('get_viewport_screenshot',{'max_size':1200,'user_prompt':'驗證遊戲素材場景操作。'})
                    images=[block for block in result.content if block.type=='image']
                    if not images: raise RuntimeError(str(result))
                    args.screenshot.write_bytes(base64.b64decode(images[0].data))
                    report['screenshot']=str(args.screenshot)
    (root/'artifacts/blender-mcp-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

asyncio.run(main())

import { getToolRegistry } from './ToolRegistry';
import { ExecTool } from './ExecTool';
import { ToolListTool } from './ToolListTool';
import { EmitChatImageTool } from './EmitChatImageTool';

let registered = false;

export function registerDefaultTools(): void {
  const registry = getToolRegistry();

  const ensure = (tool: any) => {
    const name = String(tool?.name || '');
    if (!name) {
      return;
    }
    if (!registry.get(name)) {
      registry.register(tool);
    }
  };

  ensure(new ExecTool());
  ensure(new ToolListTool());
  ensure(new EmitChatImageTool());
  registered = true;
}

export { getToolRegistry } from './ToolRegistry';
export { BaseTool } from './BaseTool';
export { ExecTool } from './ExecTool';
export { ToolListTool } from './ToolListTool';
export { EmitChatImageTool } from './EmitChatImageTool';
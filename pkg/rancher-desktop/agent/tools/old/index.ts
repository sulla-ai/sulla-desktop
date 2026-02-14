import { getToolRegistry } from './ToolRegistry';
import { RdctlTool } from './RdctlTool';
import { ExecTool } from './ExecTool';
import { RedisTool } from './RedisTool';
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

  ensure(new RdctlTool());
  ensure(new ExecTool());
  ensure(new RedisTool());
  ensure(new ToolListTool());
  ensure(new EmitChatImageTool());
  registered = true;
}

export { getToolRegistry } from './ToolRegistry';
export { BaseTool } from './BaseTool';
export { ExecTool } from './ExecTool';
export { RedisTool } from './RedisTool';
export { RdctlTool } from './RdctlTool';
export { ToolListTool } from './ToolListTool';
export { EmitChatImageTool } from './EmitChatImageTool';
import { getToolRegistry } from './ToolRegistry';
import { RdctlTool } from './RdctlTool';
import { ExecTool } from './ExecTool';
import { PgTool } from './PgTool';
import { RedisTool } from './RedisTool';
import { ToolListTool } from './ToolListTool';
import { EmitChatImageTool } from './EmitChatImageTool';
import { SlackTool } from '../../integrations/slack/SlackTool';

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
  ensure(new PgTool());
  ensure(new RedisTool());
  ensure(new ToolListTool());
  ensure(new EmitChatImageTool());
  ensure(new SlackTool());
  registered = true;
}

export { getToolRegistry } from './ToolRegistry';
export { BaseTool } from './BaseTool';
export { ExecTool } from './ExecTool';
export { PgTool } from './PgTool';
export { RedisTool } from './RedisTool';
export { RdctlTool } from './RdctlTool';
export { ToolListTool } from './ToolListTool';
export { EmitChatImageTool } from './EmitChatImageTool';
export { SlackTool } from '../../integrations/slack/SlackTool';
import { z } from 'zod';
import { BaseTool } from '../base';
import { toolRegistry } from '../registry';

export class GetWorkspacePathTool extends BaseTool {
  name = 'get_workspace_path';
  description = 'Get the full path of a workspace in the Lima VM.';
  schema = z.object({
    name: z.string().describe('The name of the workspace.'),
  });

  protected async _call(input: z.infer<this['schema']>) {
    const { name } = input;
    return { success: true, path: `/workspaces/${name}` };
  }
}

toolRegistry.registerLazy('get_workspace_path', async () => new GetWorkspacePathTool(), 'workspace');

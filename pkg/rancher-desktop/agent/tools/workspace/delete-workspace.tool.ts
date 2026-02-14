import { z } from 'zod';
import { BaseTool } from '../base';
import { toolRegistry } from '../registry';
import { execSync } from 'child_process';
import path from 'path';
import os from 'os';

export class DeleteWorkspaceTool extends BaseTool {
  name = 'delete_workspace';
  description = 'Delete an existing workspace directory in the Lima VM.';
  schema = z.object({
    name: z.string().describe('The name of the workspace to delete.'),
  });

  protected async _call(input: z.infer<this['schema']>) {
    const { name } = input;
    const limaHome = path.join(os.homedir(), 'Library/Application Support/rancher-desktop/lima');
    const limactlPath = path.join(__dirname, '../../../resources/darwin/lima/bin/limactl');
    try {
      execSync(`${limactlPath} shell 0 -- rm -rf /workspaces/${name}`, {
        env: { ...process.env, LIMA_HOME: limaHome }
      });
      return { success: true, message: `Workspace ${name} deleted.` };
    } catch (error: any) {
      return { success: false, error: `Failed to delete workspace: ${error.message}` };
    }
  }
}

toolRegistry.registerLazy('delete_workspace', async () => new DeleteWorkspaceTool(), 'workspace');

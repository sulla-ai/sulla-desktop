import { z } from 'zod';
import { BaseTool } from '../base';
import { toolRegistry } from '../registry';
import { execSync } from 'child_process';
import path from 'path';
import os from 'os';

export class ViewWorkspaceFilesTool extends BaseTool {
  name = 'view_workspace_files';
  description = 'List files in a workspace directory in the Lima VM.';
  schema = z.object({
    name: z.string().describe('The name of the workspace to view.'),
  });

  protected async _call(input: z.infer<this['schema']>) {
    const { name } = input;
    const limaHome = path.join(os.homedir(), 'Library/Application Support/rancher-desktop/lima');
    const limactlPath = path.join(process.cwd(), '../../resources/darwin/lima/bin/limactl');
    try {
      const output = execSync(`${limactlPath} shell 0 -- ls -la /workspaces/${name}`, {
        env: { ...process.env, LIMA_HOME: limaHome },
        encoding: 'utf-8'
      });
      return { success: true, files: output.trim().split('\n') };
    } catch (error: any) {
      return { success: false, error: `Failed to view workspace: ${error.message}` };
    }
  }
}

toolRegistry.registerLazy('view_workspace_files', async () => new ViewWorkspaceFilesTool(), 'workspace');

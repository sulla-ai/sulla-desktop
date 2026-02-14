import { z } from 'zod';
import { BaseTool } from '../base';
import { toolRegistry } from '../registry';
import { execSync } from 'child_process';
import path from 'path';
import os from 'os';

export class CreateWorkspaceTool extends BaseTool {
  name = 'create_workspace';
  description = 'Create a new workspace directory in the Lima VM.';
  schema = z.object({
    name: z.string().describe('The name of the workspace to create.'),
  });

  protected async _call(input: z.infer<this['schema']>) {
    const { name } = input;
    const limaHome = path.join(os.homedir(), 'Library/Application Support/rancher-desktop/lima');
    const limactlPath = path.join(process.cwd(), '../../resources/darwin/lima/bin/limactl');
    try {
      execSync(`${limactlPath} shell 0 -- mkdir -p /workspaces/${name}`, {
        env: { ...process.env, LIMA_HOME: limaHome }
      });
      return { success: true, path: `/workspaces/${name}` };
    } catch (error: any) {
      return { success: false, error: `Failed to create workspace: ${error.message}` };
    }
  }
}

toolRegistry.registerLazy('create_workspace', async () => new CreateWorkspaceTool(), 'workspace');

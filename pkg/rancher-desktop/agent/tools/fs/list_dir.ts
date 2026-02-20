import fs from 'fs';

import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { resolveFsPath } from './path_utils';

export class FsListDirWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const targetPath = resolveFsPath(input.path);

    try {
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });
      const lines = entries.map((entry) => `${entry.isDirectory() ? 'd' : '-'} ${entry.name}`);
      return {
        successBoolean: true,
        responseString: lines.join('\n'),
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to list directory at "${targetPath}": ${error.message}`,
      };
    }
  }
}

export const fsListDirRegistration: ToolRegistration = {
  name: 'fs_list_dir',
  description: 'List files and directories at a path.',
  category: 'fs',
  schemaDef: {
    path: { type: 'string' as const, description: 'Directory path to list.' },
  },
  workerClass: FsListDirWorker,
};

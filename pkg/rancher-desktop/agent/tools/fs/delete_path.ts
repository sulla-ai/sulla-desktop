import fs from 'fs';

import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { resolveFsPath } from './path_utils';

export class FsDeletePathWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const targetPath = resolveFsPath(input.path);
    const recursive = input.recursive === true;
    const force = input.force !== false;

    try {
      fs.rmSync(targetPath, { recursive, force });
      return {
        successBoolean: true,
        responseString: `Deleted path ${targetPath}`,
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to delete path "${targetPath}": ${error.message}`,
      };
    }
  }
}

export const fsDeletePathRegistration: ToolRegistration = {
  name: 'fs_delete_path',
  description: 'Delete a file or directory path.',
  category: 'fs',
  schemaDef: {
    path: { type: 'string' as const, description: 'File or directory path to delete.' },
    recursive: { type: 'boolean' as const, optional: true, description: 'Required for directory trees. Default false.' },
    force: { type: 'boolean' as const, optional: true, description: 'Ignore missing paths. Default true.' },
  },
  workerClass: FsDeletePathWorker,
};

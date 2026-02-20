import fs from 'fs';

import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { resolveFsPath } from './path_utils';

export class FsMkdirWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const targetPath = resolveFsPath(input.path);
    const recursive = input.recursive !== false;

    try {
      fs.mkdirSync(targetPath, { recursive });
      return {
        successBoolean: true,
        responseString: `Created directory at ${targetPath}`,
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to create directory at "${targetPath}": ${error.message}`,
      };
    }
  }
}

export const fsMkdirRegistration: ToolRegistration = {
  name: 'fs_mkdir',
  description: 'Create a directory.',
  category: 'fs',
  schemaDef: {
    path: { type: 'string' as const, description: 'Directory path to create.' },
    recursive: { type: 'boolean' as const, optional: true, description: 'Create nested directories. Default true.' },
  },
  workerClass: FsMkdirWorker,
};

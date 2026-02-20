import fs from 'fs';

import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { resolveFsPath } from './path_utils';

export class FsReadFileWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const targetPath = resolveFsPath(input.path);

    try {
      const content = fs.readFileSync(targetPath, 'utf8');
      return {
        successBoolean: true,
        responseString: content,
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to read file at "${targetPath}": ${error.message}`,
      };
    }
  }
}

export const fsReadFileRegistration: ToolRegistration = {
  name: 'fs_read_file',
  description: 'Read a text file and return its contents.',
  category: 'fs',
  schemaDef: {
    path: { type: 'string' as const, description: 'File path to read.' },
  },
  workerClass: FsReadFileWorker,
};

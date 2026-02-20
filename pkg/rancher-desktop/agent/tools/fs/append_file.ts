import fs from 'fs';
import path from 'path';

import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { resolveFsPath } from './path_utils';

export class FsAppendFileWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const targetPath = resolveFsPath(input.path);
    const content = String(input.content ?? '');
    const createDirs = input.createDirs !== false;

    try {
      if (createDirs) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      }
      fs.appendFileSync(targetPath, content, 'utf8');
      return {
        successBoolean: true,
        responseString: `Appended ${content.length} bytes to ${targetPath}`,
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to append file at "${targetPath}": ${error.message}`,
      };
    }
  }
}

export const fsAppendFileRegistration: ToolRegistration = {
  name: 'fs_append_file',
  description: 'Append text content to a file.',
  category: 'fs',
  schemaDef: {
    path: { type: 'string' as const, description: 'File path to append to.' },
    content: { type: 'string' as const, description: 'Content to append to file.' },
    createDirs: { type: 'boolean' as const, optional: true, description: 'Create parent directories if missing. Default true.' },
  },
  workerClass: FsAppendFileWorker,
};

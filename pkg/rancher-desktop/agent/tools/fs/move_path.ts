import fs from 'fs';
import path from 'path';

import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { resolveFsPath } from './path_utils';

export class FsMovePathWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const sourcePath = resolveFsPath(input.sourcePath);
    const destinationPath = resolveFsPath(input.destinationPath);
    const createDirs = input.createDirs !== false;

    try {
      if (createDirs) {
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      }
      fs.renameSync(sourcePath, destinationPath);
      return {
        successBoolean: true,
        responseString: `Moved ${sourcePath} to ${destinationPath}`,
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to move path from "${sourcePath}" to "${destinationPath}": ${error.message}`,
      };
    }
  }
}

export const fsMovePathRegistration: ToolRegistration = {
  name: 'fs_move_path',
  description: 'Move or rename a file/directory path.',
  category: 'fs',
  schemaDef: {
    sourcePath: { type: 'string' as const, description: 'Source file or directory path.' },
    destinationPath: { type: 'string' as const, description: 'Destination file or directory path.' },
    createDirs: { type: 'boolean' as const, optional: true, description: 'Create parent directory for destination if missing. Default true.' },
  },
  workerClass: FsMovePathWorker,
};

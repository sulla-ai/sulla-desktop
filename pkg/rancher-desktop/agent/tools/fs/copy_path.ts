import fs from 'fs';
import path from 'path';

import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { resolveFsPath } from './path_utils';

export class FsCopyPathWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const sourcePath = resolveFsPath(input.sourcePath);
    const destinationPath = resolveFsPath(input.destinationPath);
    const recursive = input.recursive !== false;
    const overwrite = input.overwrite === true;
    const createDirs = input.createDirs !== false;

    try {
      if (createDirs) {
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      }
      fs.cpSync(sourcePath, destinationPath, { recursive, force: overwrite });
      return {
        successBoolean: true,
        responseString: `Copied ${sourcePath} to ${destinationPath}`,
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to copy path from "${sourcePath}" to "${destinationPath}": ${error.message}`,
      };
    }
  }
}

export const fsCopyPathRegistration: ToolRegistration = {
  name: 'fs_copy_path',
  description: 'Copy a file or directory path.',
  category: 'fs',
  schemaDef: {
    sourcePath: { type: 'string' as const, description: 'Source file or directory path.' },
    destinationPath: { type: 'string' as const, description: 'Destination file or directory path.' },
    recursive: { type: 'boolean' as const, optional: true, description: 'Copy directories recursively. Default true.' },
    overwrite: { type: 'boolean' as const, optional: true, description: 'Overwrite destination when true. Default false.' },
    createDirs: { type: 'boolean' as const, optional: true, description: 'Create parent directory for destination if missing. Default true.' },
  },
  workerClass: FsCopyPathWorker,
};

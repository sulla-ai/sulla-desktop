import fs from 'fs';

import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { resolveFsPath } from './path_utils';

export class FsPathInfoWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const targetPath = resolveFsPath(input.path);

    try {
      const stats = fs.statSync(targetPath);
      const payload = {
        path: targetPath,
        exists: true,
        type: stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other',
        size: stats.size,
        mtime: stats.mtime.toISOString(),
        ctime: stats.ctime.toISOString(),
      };

      return {
        successBoolean: true,
        responseString: JSON.stringify(payload, null, 2),
      };
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return {
          successBoolean: true,
          responseString: JSON.stringify({ path: targetPath, exists: false }, null, 2),
        };
      }

      return {
        successBoolean: false,
        responseString: `Failed to stat path "${targetPath}": ${error.message}`,
      };
    }
  }
}

export const fsPathInfoRegistration: ToolRegistration = {
  name: 'fs_path_info',
  description: 'Get metadata for a filesystem path.',
  category: 'fs',
  operationTypes: ['read'],
  schemaDef: {
    path: { type: 'string' as const, description: 'Path to inspect.' },
  },
  workerClass: FsPathInfoWorker,
};

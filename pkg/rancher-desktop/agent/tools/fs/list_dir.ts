import fs from 'fs';

import { BaseTool, ToolResponse } from '../base';
import { resolveFsPath } from './path_utils';

export class FsListDirWorker extends BaseTool {
  name: string = '';
  description: string = '';

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


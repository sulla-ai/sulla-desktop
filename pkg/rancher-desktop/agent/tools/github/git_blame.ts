import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * Git Blame Tool - Shows who last modified each line of a file.
 */
export class GitBlameWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { absolutePath } = input;
    const startLine = input.startLine ? Number(input.startLine) : null;
    const endLine = input.endLine ? Number(input.endLine) : null;

    try {
      // Resolve the repo root
      const repoRoot = execSync(`git -C "${path.dirname(absolutePath)}" rev-parse --show-toplevel`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      // Build blame command
      let cmd = `git -C "${repoRoot}" blame --line-porcelain "${absolutePath}"`;
      if (startLine && endLine) {
        cmd = `git -C "${repoRoot}" blame -L ${startLine},${endLine} --line-porcelain "${absolutePath}"`;
      } else if (startLine) {
        cmd = `git -C "${repoRoot}" blame -L ${startLine}, --line-porcelain "${absolutePath}"`;
      }

      const rawOutput = execSync(cmd, {
        stdio: 'pipe',
        env: { ...process.env },
        maxBuffer: 1024 * 1024 * 5,
      }).toString();

      // Parse porcelain output into a readable summary
      const lines: string[] = [];
      const chunks = rawOutput.split(/^[0-9a-f]{40}\s/m).filter(Boolean);

      for (const chunk of chunks) {
        const authorMatch = chunk.match(/^author (.+)$/m);
        const timeMatch = chunk.match(/^author-time (\d+)$/m);
        const lineMatch = chunk.match(/^(\d+)\s(\d+)\s?(\d+)?$/m);
        const contentMatch = chunk.match(/^\t(.*)$/m);

        const author = authorMatch ? authorMatch[1] : 'unknown';
        const timestamp = timeMatch ? new Date(Number(timeMatch[1]) * 1000).toISOString().split('T')[0] : '?';
        const lineNum = lineMatch ? lineMatch[2] : '?';
        const content = contentMatch ? contentMatch[1] : '';

        lines.push(`${lineNum}\t${author}\t${timestamp}\t${content}`);
      }

      // Cap output to avoid overwhelming context
      const maxLines = 300;
      const output = lines.length > maxLines
        ? lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`
        : lines.join('\n');

      return {
        successBoolean: true,
        responseString: `git blame for ${absolutePath}:\nLINE\tAUTHOR\tDATE\tCONTENT\n${output}`,
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Git blame failed: ${error.message}`,
      };
    }
  }
}

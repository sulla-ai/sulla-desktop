import { spawn } from 'child_process';

export async function runCommand(
  command: string,
  args: string[],
  options: { timeoutMs?: number; maxOutputChars?: number; stdin?: string } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxOutputChars = options.maxOutputChars ?? 80_000;

  return await new Promise(resolve => {
    let child;
    try {
      child = spawn(command, args, { stdio: 'pipe' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      resolve({ stdout: '', stderr: `Command '${command}' failed to start: ${message}`, exitCode: 127 });
      return;
    }

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
      }
    }, timeoutMs);

    // Handle spawn errors (e.g., ENOENT when command not found)
    child.on('error', (err) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({ stdout: '', stderr: `Command '${command}' not found or failed: ${err.message}`, exitCode: 127 });
      }
    });

    child.stdout.on('data', d => {
      stdout += d.toString();
      if (stdout.length > maxOutputChars * 2) {
        stdout = `${stdout.slice(0, maxOutputChars * 2)}\n...<truncated>`;
      }
    });

    child.stderr.on('data', d => {
      stderr += d.toString();
      if (stderr.length > maxOutputChars * 2) {
        stderr = `${stderr.slice(0, maxOutputChars * 2)}\n...<truncated>`;
      }
    });

    child.on('close', code => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);

        const truncatedStdout = stdout.length > maxOutputChars ? `${stdout.slice(0, maxOutputChars)}\n...<truncated>` : stdout;
        const truncatedStderr = stderr.length > maxOutputChars ? `${stderr.slice(0, maxOutputChars)}\n...<truncated>` : stderr;

        resolve({ stdout: truncatedStdout, stderr: truncatedStderr, exitCode: code ?? 0 });
      }
    });

    if (options.stdin) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();
  });
}

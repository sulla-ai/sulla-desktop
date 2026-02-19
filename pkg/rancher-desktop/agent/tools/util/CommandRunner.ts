import { spawn } from 'child_process';

export interface CommandRunnerOptions {
  timeoutMs?: number;
  maxOutputChars?: number;
  stdin?: string;
  runInLimaShell?: boolean;
  limaInstance?: string;
  limaHome?: string;
  limactlPath?: string;
}

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9_\-./:=@]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function executeSpawn(
  command: string,
  args: string[],
  options: CommandRunnerOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxOutputChars = options.maxOutputChars ?? 200_000;

  return new Promise(resolve => {
    let child;
    try {
      child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      resolve({
        stdout: '',
        stderr: `Failed to spawn '${command}': ${errorMessage}`,
        exitCode: 127,
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        child.kill('SIGKILL');
        finished = true;
        resolve({
          stdout: stdout.slice(0, maxOutputChars) + '\n[timeout truncated]',
          stderr: stderr.slice(0, maxOutputChars) + '\n[timeout]',
          exitCode: -1,
        });
      }
    }, timeoutMs);

    child.on('error', err => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({
          stdout: '',
          stderr: `Spawn error: ${err.message}`,
          exitCode: 127,
        });
      }
    });

    child.stdout?.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.length > maxOutputChars * 2) stdout = stdout.slice(0, maxOutputChars * 2) + '\n[truncated]';
    });

    child.stderr?.on('data', chunk => {
      stderr += chunk.toString();
      if (stderr.length > maxOutputChars * 2) stderr = stderr.slice(0, maxOutputChars * 2) + '\n[truncated]';
    });

    child.on('close', code => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);

        const out = stdout.length > maxOutputChars ? stdout.slice(0, maxOutputChars) + '\n[truncated]' : stdout;
        const err = stderr.length > maxOutputChars ? stderr.slice(0, maxOutputChars) + '\n[truncated]' : stderr;

        resolve({ stdout: out, stderr: err, exitCode: code ?? 0 });
      }
    });

    if (options.stdin) {
      child.stdin?.write(options.stdin);
      child.stdin?.end();
    } else {
      child.stdin?.end();
    }
  });
}

export async function runCommand(
  command: string,
  args: string[],
  options: CommandRunnerOptions = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (options.runInLimaShell) {
    const limaHome = options.limaHome || process.env.LIMA_HOME || `${process.env.HOME || ''}/Library/Application Support/rancher-desktop/lima`;
    const limactlPath = options.limactlPath || process.env.LIMACTL_PATH || 'resources/darwin/lima/bin/limactl';
    const limaInstance = options.limaInstance || '0';

    const script = args.length === 0
      ? command
      : [command, ...args.map(arg => quoteShellArg(arg))].join(' ');

    const limactlArgs = ['shell', limaInstance, '--', 'sh', '-lc', script];
    let result = await executeSpawn('env', [`LIMA_HOME=${limaHome}`, limactlPath, ...limactlArgs], options);

    if (result.exitCode === 127) {
      result = await executeSpawn('env', [`LIMA_HOME=${limaHome}`, 'limactl', ...limactlArgs], options);
    }

    return result;
  }

  // Special handling for sh/bash -c full scripts
  let finalCommand = command;
  let finalArgs = [...args];

  if (command === 'sh' && args.length >= 2 && args[0] === '-c') {
    // Join remaining args as full script (preserves pipes, &&, redirects)
    const script = args.slice(1).join(' ');
    finalArgs = ['-c', script];
  } else if (command === 'bash' || command === 'zsh') {
    // Same logic for other shells
    const script = args.join(' ');
    finalArgs = ['-c', script];
  }

  return executeSpawn(finalCommand, finalArgs, options);
}
import { describe, expect, it } from '@jest/globals';

import { runCommand } from '../CommandRunner';

describe('CommandRunner', () => {
  it('runs shell commands successfully (baseline PATH/shell access)', async () => {
    const result = await runCommand('sh', ['-c', 'echo hello'], {
      timeoutMs: 5_000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello');
  });

  it('returns ENOENT-style errors for missing binaries', async () => {
    const result = await runCommand('/definitely/missing/binary', [], {
      timeoutMs: 5_000,
    });

    expect(result.exitCode).toBe(127);
    expect(result.stderr).toContain('Spawn error');
  });

  it('Lima shell mode fails gracefully when limactl cannot be resolved', async () => {
    const previousPath = process.env.PATH;
    process.env.PATH = '';

    try {
      const result = await runCommand('echo hello', [], {
        runInLimaShell: true,
        limaHome: '/tmp/lima-home',
        limactlPath: '/definitely/missing/limactl',
        timeoutMs: 5_000,
      });

      expect(result.exitCode).not.toBe(0);
      expect(`${result.stderr}\n${result.stdout}`).toMatch(/not found|no such file|spawn error|does not exist/i);
    } finally {
      process.env.PATH = previousPath;
    }
  });
});

import { describe, expect, it } from '@jest/globals';

import { DockerExecWorker } from '../docker_exec';

describe('docker_exec argument handling', () => {
  it('preserves complex command strings by routing through sh -lc', () => {
    const worker = new DockerExecWorker() as any;

    const command = 'curl -H "Authorization: Basic TOKEN WITH SPACE" https://example.com';
    const args = worker.buildExecArgs('container-1', command);

    expect(args).toEqual([
      'exec',
      'container-1',
      'sh',
      '-lc',
      command,
    ]);
  });

  it('does not split quoted arguments into multiple docker exec args', () => {
    const worker = new DockerExecWorker() as any;

    const command = "echo 'hello world' && printf '%s' \"x y\"";
    const args = worker.buildExecArgs('container-2', command);

    expect(args[4]).toBe(command);
    expect(args.length).toBe(5);
  });
});

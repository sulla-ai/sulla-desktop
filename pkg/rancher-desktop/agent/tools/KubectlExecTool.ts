import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlExecTool extends BaseTool {
  override readonly name = 'kubectl_exec';
  override readonly category = 'kubernetes_exec';

  override getPlanningInstructions(): string {
    return [
      '22) kubectl_exec (Kubernetes via kubectl)',
      '   - Purpose: Execute a shell command inside a pod/container.',
      '   - Args:',
      '     - namespace (string, required)',
      '     - pod (string, required)',
      '     - container (string, optional)',
      '     - command (string, required) executed via `sh -lc`',
      '     - timeoutSeconds (number, optional, default 30)',
      '   - Output: stdout/stderr/exitCode.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = String(context.args?.namespace || '');
    const pod = String(context.args?.pod || context.args?.name || '');
    const container = context.args?.container ? String(context.args.container) : '';
    const command = String(context.args?.command || '');
    const timeoutSeconds = Number(context.args?.timeoutSeconds ?? 30);

    if (!ns || !pod || !command) {
      return { toolName: this.name, success: false, error: 'Missing args: namespace, pod, command' };
    }

    const args = ['exec', '-n', ns, pod];
    if (container) {
      args.push('-c', container);
    }
    args.push('--', 'sh', '-lc', command);

    const res = await runCommand('kubectl', args, {
      timeoutMs: (Number.isFinite(timeoutSeconds) ? timeoutSeconds : 30) * 1000,
      maxOutputChars: 160_000,
    });

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl exec failed' };
    }

    return {
      toolName: this.name,
      success: true,
      result: {
        namespace: ns,
        pod,
        container: container || undefined,
        command,
        stdout: res.stdout,
        stderr: res.stderr || undefined,
        exitCode: res.exitCode,
      },
    };
  }
}

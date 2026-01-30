import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlCpToPodTool extends BaseTool {
  override readonly name = 'kubectl_cp_to_pod';
  override readonly category = 'kubernetes_exec';

  override getPlanningInstructions(): string {
    return [
      '24) kubectl_cp_to_pod (Kubernetes via kubectl)',
      '   - Purpose: Copy files/directories from the host to a pod.',
      '   - Args:',
      '     - namespace (string, required)',
      '     - pod (string, required)',
      '     - srcPath (string, required) path on the host',
      '     - destPath (string, required) path inside the pod',
      '     - container (string, optional)',
      '   - Output: copy result.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = String(context.args?.namespace || '');
    const pod = String(context.args?.pod || context.args?.name || '');
    const srcPath = String(context.args?.srcPath || '');
    const destPath = String(context.args?.destPath || '');
    const container = context.args?.container ? String(context.args.container) : '';

    if (!ns || !pod || !srcPath || !destPath) {
      return { toolName: this.name, success: false, error: 'Missing args: namespace, pod, srcPath, destPath' };
    }

    const dest = `${ns}/${pod}:${destPath}`;

    const args = ['cp'];
    if (container) {
      args.push('-c', container);
    }
    args.push(srcPath, dest);

    const res = await runCommand('kubectl', args, { timeoutMs: 60_000, maxOutputChars: 120_000 });
    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl cp (to pod) failed' };
    }

    return {
      toolName: this.name,
      success: true,
      result: { namespace: ns, pod, container: container || undefined, srcPath, destPath, output: res.stdout },
    };
  }
}

import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlCpFromPodTool extends BaseTool {
  override readonly name = 'kubectl_cp_from_pod';

  override getPlanningInstructions(): string {
    return [
      '23) kubectl_cp_from_pod (Kubernetes via kubectl)',
      '   - Purpose: Copy a file/directory from a pod to the host filesystem.',
      '   - Args:',
      '     - namespace (string, required)',
      '     - pod (string, required)',
      '     - srcPath (string, required) path inside the pod',
      '     - destPath (string, required) path on the host',
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

    const src = `${ns}/${pod}:${srcPath}`;

    // Note: kubectl cp uses a special syntax; container selection is done via -c.
    const args = ['cp'];
    if (container) {
      args.push('-c', container);
    }
    args.push(src, destPath);

    const res = await runCommand('kubectl', args, { timeoutMs: 60_000, maxOutputChars: 120_000 });
    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl cp (from pod) failed' };
    }

    return {
      toolName: this.name,
      success: true,
      result: { namespace: ns, pod, container: container || undefined, srcPath, destPath, output: res.stdout },
    };
  }
}

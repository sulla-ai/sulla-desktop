import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlGetPodYamlTool extends BaseTool {
  override readonly name = 'kubectl_get_pod_yaml';
  override readonly category = 'kubernetes_debug';

  override getPlanningInstructions(): string {
    return [
      '25) kubectl_get_pod_yaml (Kubernetes via kubectl)',
      '   - Purpose: Fetch full pod YAML for inspection (debugging).',
      '   - Args:',
      '     - namespace (string, required)',
      '     - pod (string, required)',
      '   - Output: YAML (truncated if large).',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = String(context.args?.namespace || '');
    const pod = String(context.args?.pod || context.args?.name || '');

    if (!ns || !pod) {
      return { toolName: this.name, success: false, error: 'Missing args: namespace, pod' };
    }

    const res = await runCommand('kubectl', ['get', 'pod', pod, '-n', ns, '-o', 'yaml'], {
      timeoutMs: 20_000,
      maxOutputChars: 200_000,
    });

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl get pod yaml failed' };
    }

    return { toolName: this.name, success: true, result: { namespace: ns, pod, yaml: res.stdout } };
  }
}

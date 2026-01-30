import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

type DeploymentSummary = {
  namespace: string;
  name: string;
  ready?: string;
  replicas?: number;
  updatedReplicas?: number;
  availableReplicas?: number;
};

export class KubectlGetDeploymentsTool extends BaseTool {
  override readonly name = 'kubectl_get_deployments';
  override readonly category = 'kubernetes_read';

  override getPlanningInstructions(): string {
    return [
      '11) kubectl_get_deployments (Kubernetes via kubectl)',
      '   - Purpose: List deployments and summarize rollout/availability.',
      '   - Args:',
      '     - namespace (string, optional) if omitted lists across all namespaces',
      '   - Output: Deployment summaries including desired/available counts.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_get_deployments".',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = context.args?.namespace ? String(context.args.namespace) : '';
    // Avoid `-o json` because output truncation or non-JSON lines can break JSON parsing.
    // Use a deterministic tab-delimited jsonpath format.
    const jsonPath = [
      '{range .items[*]}',
      '{.metadata.namespace}',
      '\t',
      '{.metadata.name}',
      '\t',
      '{.spec.replicas}',
      '\t',
      '{.status.availableReplicas}',
      '\t',
      '{.status.updatedReplicas}',
      '{"\\n"}',
      '{end}',
    ].join('');

    const args = ns
      ? ['get', 'deployments', '-n', ns, '-o', `jsonpath=${jsonPath}`]
      : ['get', 'deployments', '-A', '-o', `jsonpath=${jsonPath}`];

    const res = await runCommand('kubectl', args, { timeoutMs: 20_000, maxOutputChars: 400_000 });
    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl get deployments failed' };
    }

    const stdout = res.stdout.trim();
    const lines = stdout ? stdout.split('\n').filter(Boolean) : [];

    const deployments: DeploymentSummary[] = [];
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 5) {
        continue;
      }

      const [namespace, name, replicasRaw, availableRaw, updatedRaw] = parts;
      const replicas = Number(replicasRaw) || 0;
      const availableReplicas = Number(availableRaw) || 0;
      const updatedReplicas = Number(updatedRaw) || 0;

      deployments.push({
        namespace: String(namespace || ''),
        name: String(name || ''),
        ready: `${availableReplicas}/${replicas}`,
        replicas,
        updatedReplicas,
        availableReplicas,
      });
    }

    const result = {
      total: deployments.length,
      deployments,
    };

    return { toolName: this.name, success: true, result };
  }
}

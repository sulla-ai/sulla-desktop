import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

type IngressSummary = {
  namespace: string;
  name: string;
  hosts?: string;
  address?: string;
  tls?: boolean;
};

export class KubectlGetIngressesTool extends BaseTool {
  override readonly name = 'kubectl_get_ingresses';
  override readonly category = 'kubernetes_read';

  override getPlanningInstructions(): string {
    return [
      '18) kubectl_get_ingresses (Kubernetes via kubectl)',
      '   - Purpose: List ingresses and key routing info.',
      '   - Args:',
      '     - namespace (string, optional) if omitted lists across all namespaces',
      '   - Output: Ingress summaries including hosts and addresses.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_get_ingresses".',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = context.args?.namespace ? String(context.args.namespace) : '';
    const args = ns ? ['get', 'ingresses', '-n', ns, '-o', 'json'] : ['get', 'ingresses', '-A', '-o', 'json'];

    const res = await runCommand('kubectl', args, { timeoutMs: 20_000, maxOutputChars: 120_000 });
    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl get ingresses failed' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(res.stdout);
    } catch {
      return { toolName: this.name, success: false, error: 'Failed to parse kubectl JSON output' };
    }

    const items: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
    const ingresses: IngressSummary[] = items.map(i => {
      const namespace = String(i?.metadata?.namespace || '');
      const name = String(i?.metadata?.name || '');
      const rules: any[] = Array.isArray(i?.spec?.rules) ? i.spec.rules : [];
      const hosts = rules.map(r => r?.host).filter(Boolean).join(',');
      const tls = Array.isArray(i?.spec?.tls) && i.spec.tls.length > 0;

      const lb = i?.status?.loadBalancer?.ingress;
      const address = Array.isArray(lb) && lb.length > 0
        ? [lb[0]?.ip, lb[0]?.hostname].filter(Boolean).join('')
        : undefined;

      return { namespace, name, hosts: hosts || undefined, address, tls };
    });

    return { toolName: this.name, success: true, result: { total: ingresses.length, ingresses } };
  }
}

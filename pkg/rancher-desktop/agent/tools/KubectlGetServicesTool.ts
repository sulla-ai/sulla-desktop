import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

type ServiceSummary = {
  namespace: string;
  name: string;
  type?: string;
  clusterIP?: string;
  externalIPs?: string;
  ports?: string;
};

export class KubectlGetServicesTool extends BaseTool {
  override readonly name = 'kubectl_get_services';

  override getPlanningInstructions(): string {
    return [
      '13) kubectl_get_services (Kubernetes via kubectl)',
      '   - Purpose: List services and connectivity-related details.',
      '   - Args:',
      '     - namespace (string, optional) if omitted lists across all namespaces',
      '   - Output: Service summaries including type, ClusterIP, External IPs, ports.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_get_services".',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = context.args?.namespace ? String(context.args.namespace) : '';
    const args = ns ? ['get', 'services', '-n', ns, '-o', 'json'] : ['get', 'services', '-A', '-o', 'json'];

    const res = await runCommand('kubectl', args, { timeoutMs: 20_000, maxOutputChars: 120_000 });
    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl get services failed' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(res.stdout);
    } catch {
      return { toolName: this.name, success: false, error: 'Failed to parse kubectl JSON output' };
    }

    const items: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
    const services: ServiceSummary[] = items.map(s => {
      const namespace = String(s?.metadata?.namespace || '');
      const name = String(s?.metadata?.name || '');
      const type = s?.spec?.type ? String(s.spec.type) : undefined;
      const clusterIP = s?.spec?.clusterIP ? String(s.spec.clusterIP) : undefined;
      const externalIPs = Array.isArray(s?.spec?.externalIPs) ? s.spec.externalIPs.join(',') : undefined;
      const ports = Array.isArray(s?.spec?.ports)
        ? s.spec.ports.map((p: any) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ''}/${p.protocol || 'TCP'}`).join(',')
        : undefined;

      return { namespace, name, type, clusterIP, externalIPs, ports };
    });

    return { toolName: this.name, success: true, result: { total: services.length, services } };
  }
}

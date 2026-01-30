import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

type NodeTopMetric = {
  name: string;
  cpu: string;
  cpuPercent?: string;
  memory: string;
  memoryPercent?: string;
};

export class KubectlTopNodesTool extends BaseTool {
  override readonly name = 'kubectl_top_nodes';

  override getPlanningInstructions(): string {
    return [
      '8) kubectl_top_nodes (Kubernetes via kubectl)',
      '   - Purpose: Show node resource usage (requires metrics-server).',
      '   - Output: `kubectl top nodes` output.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_top_nodes".',
    ].join('\n');
  }

  override async execute(_state: ThreadState, _context: ToolContext): Promise<ToolResult> {
    const res = await runCommand('kubectl', ['top', 'nodes', '--no-headers'], {
      timeoutMs: 20_000,
      maxOutputChars: 120_000,
    });

    if (res.exitCode !== 0) {
      return {
        toolName: this.name,
        success: false,
        error: res.stderr || res.stdout || 'kubectl top nodes failed (metrics-server may be missing)',
      };
    }

    const raw = res.stdout.trim();
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

    const nodes: NodeTopMetric[] = [];
    for (const line of lines) {
      // Expected columns (default kubectl):
      // NAME CPU(cores) CPU% MEMORY(bytes) MEMORY%
      // Example: node1  123m  6%  1024Mi  12%
      const parts = line.split(/\s+/);
      if (parts.length < 3) {
        continue;
      }

      const name = parts[0];
      const cpu = parts[1] || '';
      const cpuPercent = parts.length >= 3 ? parts[2] : undefined;
      const memory = parts.length >= 4 ? parts[3] : '';
      const memoryPercent = parts.length >= 5 ? parts[4] : undefined;

      if (!name || !cpu) {
        continue;
      }

      nodes.push({ name, cpu, cpuPercent, memory, memoryPercent });
    }

    return {
      toolName: this.name,
      success: true,
      result: {
        total: nodes.length,
        nodes,
        output: raw,
      },
    };
  }
}

import { TextDecoder, TextEncoder } from 'node:util';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';

let N8nServiceClass: any;

describe('N8nService.activateWorkflow', () => {
  beforeAll(async () => {
    (globalThis as any).TextEncoder = TextEncoder;
    (globalThis as any).TextDecoder = TextDecoder;
    const mod = await import('../N8nService');
    N8nServiceClass = mod.N8nService;
  });

  it('falls back to PATCH /workflows/:id when /activate returns 404', async () => {
    const service = new N8nServiceClass() as any;

    let callCount = 0;
    const requestMock = jest.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error('N8n API error 404: Not Found');
      }
      return { id: 'wf_1', active: true };
    });

    service.request = requestMock;

    const result = await service.activateWorkflow('  wf_1  ', { name: 'Activate' });

    expect(result).toEqual({ id: 'wf_1', active: true });
    expect(requestMock).toHaveBeenCalledTimes(2);
    const calls = (requestMock as any).mock.calls as any[];
    expect(calls[0][0]).toBe('/api/v1/workflows/wf_1/activate');
    expect(calls[0][1]).toEqual({
      method: 'POST',
      body: JSON.stringify({ versionId: '', name: 'Activate', description: '' }),
    });
    expect(calls[1][0]).toBe('/api/v1/workflows/wf_1');
    expect(calls[1][1]).toEqual({
      method: 'PATCH',
      body: JSON.stringify({ active: true }),
    });
  });

  it('rethrows non-404 activation errors', async () => {
    const service = new N8nServiceClass() as any;

    const requestMock = jest.fn(async () => {
      throw new Error('N8n API error 500: Internal Server Error');
    });

    service.request = requestMock;

    await expect(service.activateWorkflow('wf_2')).rejects.toThrow('N8n API error 500');
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('throws for blank workflow IDs', async () => {
    const service = new N8nServiceClass();
    await expect(service.activateWorkflow('   ')).rejects.toThrow('Workflow ID is required for activation');
  });
});

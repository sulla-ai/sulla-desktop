import { afterEach, describe, expect, it, jest } from '@jest/globals';

const mockGetWorkflow: any = jest.fn();
const mockUpdateWorkflow: any = jest.fn();

jest.unstable_mockModule('../../../services/N8nService', () => ({
  createN8nService: jest.fn(async () => ({
    getWorkflow: mockGetWorkflow,
    updateWorkflow: mockUpdateWorkflow,
  })),
}));

async function loadNodeTools() {
  const getModule = await import('../get_workflow_node');
  const addModule = await import('../add_workflow_node');
  const updateModule = await import('../update_workflow_node');
  const removeModule = await import('../remove_workflow_node');

  return {
    getModule,
    addModule,
    updateModule,
    removeModule,
  };
}

function configureWorker(worker: any, registration: any) {
  worker.name = registration.name;
  worker.description = registration.description;
  worker.schemaDef = registration.schemaDef;
  return worker;
}

describe('n8n workflow node tools', () => {
  afterEach(() => {
    mockGetWorkflow.mockReset();
    mockUpdateWorkflow.mockReset();
  });

  it('adds a node with deterministic id and unique name', async () => {
    const { addModule } = await loadNodeTools();
    const worker = configureWorker(new addModule.AddWorkflowNodeWorker(), addModule.addWorkflowNodeRegistration);

    mockGetWorkflow.mockResolvedValueOnce({
      id: 'wf-1',
      name: 'Workflow A',
      nodes: [
        { id: 'trigger-1', name: 'Trigger', type: 'n8n-nodes-base.manualTrigger', position: [0, 0], parameters: {} },
      ],
      connections: {},
      settings: {},
    });

    mockUpdateWorkflow.mockResolvedValueOnce({ id: 'wf-1' });

    const result = await worker.invoke({
      workflowId: 'wf-1',
      node: {
        name: 'Trigger',
        type: 'n8n-nodes-base.httpRequest',
        position: [240, 0],
        parameters: {},
      },
    });

    expect(result.success).toBe(true);
    const updateArg = mockUpdateWorkflow.mock.calls[0][1];
    const insertedNode = updateArg.nodes[1];
    expect(insertedNode.name).toBe('Trigger (2)');
    expect(insertedNode.type).toBe('n8n-nodes-base.httpRequest');
    expect(String(insertedNode.id)).toMatch(/^trigger-2/);
  });

  it('updates a node name and rewrites connections by node name', async () => {
    const { updateModule } = await loadNodeTools();
    const worker = configureWorker(new updateModule.UpdateWorkflowNodeWorker(), updateModule.updateWorkflowNodeRegistration);

    mockGetWorkflow.mockResolvedValueOnce({
      id: 'wf-2',
      name: 'Workflow B',
      nodes: [
        { id: 'node-a', name: 'Source', type: 'n8n-nodes-base.manualTrigger', position: [0, 0], parameters: {} },
        { id: 'node-b', name: 'Old Name', type: 'n8n-nodes-base.httpRequest', position: [240, 0], parameters: {} },
      ],
      connections: {
        Source: {
          main: [[{ node: 'Old Name', type: 'main', index: 0 }]],
        },
        'Old Name': {
          main: [[]],
        },
      },
      settings: {},
    });

    mockUpdateWorkflow.mockResolvedValueOnce({ id: 'wf-2' });

    const result = await worker.invoke({
      workflowId: 'wf-2',
      nodeId: 'node-b',
      nodePatch: { name: 'New Name' },
    });

    expect(result.success).toBe(true);
    const updateArg = mockUpdateWorkflow.mock.calls[0][1];
    expect(updateArg.nodes[1].name).toBe('New Name');
    expect(updateArg.connections['Old Name']).toBeUndefined();
    expect(updateArg.connections['New Name']).toBeDefined();
    expect(updateArg.connections.Source.main[0][0].node).toBe('New Name');
  });

  it('removes a node and strips references from connections', async () => {
    const { removeModule } = await loadNodeTools();
    const worker = configureWorker(new removeModule.RemoveWorkflowNodeWorker(), removeModule.removeWorkflowNodeRegistration);

    mockGetWorkflow.mockResolvedValueOnce({
      id: 'wf-3',
      name: 'Workflow C',
      nodes: [
        { id: 'node-a', name: 'Source', type: 'n8n-nodes-base.manualTrigger', position: [0, 0], parameters: {} },
        { id: 'node-b', name: 'Delete Me', type: 'n8n-nodes-base.httpRequest', position: [240, 0], parameters: {} },
      ],
      connections: {
        Source: {
          main: [[{ node: 'Delete Me', type: 'main', index: 0 }]],
        },
        'Delete Me': {
          main: [[{ node: 'Source', type: 'main', index: 0 }]],
        },
      },
      settings: {},
    });

    mockUpdateWorkflow.mockResolvedValueOnce({ id: 'wf-3' });

    const result = await worker.invoke({
      workflowId: 'wf-3',
      nodeName: 'Delete Me',
    });

    expect(result.success).toBe(true);
    const updateArg = mockUpdateWorkflow.mock.calls[0][1];
    expect(updateArg.nodes).toHaveLength(1);
    expect(updateArg.connections['Delete Me']).toBeUndefined();
    expect(updateArg.connections.Source.main[0]).toEqual([]);
  });

  it('gets a single node with connection counts', async () => {
    const { getModule } = await loadNodeTools();
    const worker = configureWorker(new getModule.GetWorkflowNodeWorker(), getModule.getWorkflowNodeRegistration);

    mockGetWorkflow.mockResolvedValueOnce({
      id: 'wf-4',
      name: 'Workflow D',
      nodes: [
        { id: 'node-a', name: 'Source', type: 'n8n-nodes-base.manualTrigger', position: [0, 0], parameters: {} },
        { id: 'node-b', name: 'Target', type: 'n8n-nodes-base.httpRequest', position: [240, 0], parameters: {} },
      ],
      connections: {
        Source: {
          main: [[{ node: 'Target', type: 'main', index: 0 }]],
        },
      },
      settings: {},
    });

    const result = await worker.invoke({
      workflowId: 'wf-4',
      nodeId: 'node-b',
    });

    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.result as string);
    expect(parsed.node.id).toBe('node-b');
    expect(parsed.connections.inbound).toBe(1);
  });
});

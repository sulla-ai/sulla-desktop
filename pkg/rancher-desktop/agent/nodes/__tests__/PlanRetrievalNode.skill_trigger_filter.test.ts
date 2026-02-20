import { TextDecoder, TextEncoder } from 'node:util';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder;

const mockFindByTag: any = jest.fn();
const mockRedisSet: any = jest.fn(async () => undefined);

jest.unstable_mockModule('../../database/models/Article', () => ({
  Article: {
    findByTag: mockFindByTag,
  },
}));

jest.unstable_mockModule('../../database/RedisClient', () => ({
  redisClient: {
    initialize: jest.fn(async () => undefined),
    get: jest.fn(async () => null),
    set: mockRedisSet,
  },
}));

jest.unstable_mockModule('../../database/registry/ArticlesRegistry', () => ({
  articlesRegistry: {
    searchByKeywords: jest.fn(async () => []),
  },
}));

jest.unstable_mockModule('../ActivePlanManager', () => ({
  ActivePlanManager: {
    getInstance: jest.fn(() => ({
      getActiveSkills: jest.fn(async () => ({ planSummaries: [] })),
    })),
  },
}));

jest.unstable_mockModule('../BaseNode', () => ({
  BaseNode: class MockBaseNode {
    constructor(public id: string, public name: string) {}
  },
  JSON_ONLY_RESPONSE_INSTRUCTIONS: 'mock-json-only',
}));

async function loadModule() {
  return import('../PlanRetrievalNode');
}

describe('PlanRetrievalNode skill trigger filtering', () => {
  afterEach(() => {
    mockFindByTag.mockReset();
    mockRedisSet.mockReset();
  });

  it('excludes skill-tagged articles that do not define a real trigger', async () => {
    const { PlanRetrievalNode } = await loadModule();

    mockFindByTag.mockResolvedValueOnce([
      {
        attributes: {
          slug: 'create-workflow',
          title: 'Create Workflow',
          document: '**Trigger**: create a workflow in n8n',
        },
      },
      {
        attributes: {
          slug: 'test-the-three-previously-broken-n8n-functions-create-workflow-update-workflow-and-activate-workflow-tprd',
          title: 'Technical Execution Brief',
          document: '**Trigger**: No trigger defined',
        },
      },
      {
        attributes: {
          slug: 'missing-trigger',
          title: 'No Trigger Article',
          document: 'This article has no trigger line.',
        },
      },
    ]);

    const node = new PlanRetrievalNode() as any;
    const output = await node.loadSkillTriggersFromDatabase('skills:key', 'skills:ts');

    expect(output).toContain('Create Workflow');
    expect(output).toContain('Trigger: create a workflow in n8n');
    expect(output).not.toContain('Technical Execution Brief');
    expect(output).not.toContain('No trigger defined');
    expect(output).not.toContain('No Trigger Article');
  });
});

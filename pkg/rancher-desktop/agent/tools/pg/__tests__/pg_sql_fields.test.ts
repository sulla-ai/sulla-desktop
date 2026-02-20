import { TextDecoder, TextEncoder } from 'node:util';
import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

function configureWorker(worker: any, registration: any) {
  worker.name = registration.name;
  worker.description = registration.description;
  worker.schemaDef = registration.schemaDef;
  return worker;
}

async function loadPgModules() {
  const pgQueryModule = await import('../pg_query');
  const pgExecuteModule = await import('../pg_execute');
  const postgresModule = await import('../../../database/PostgresClient');

  return {
    pgQueryModule,
    pgExecuteModule,
    postgresClient: postgresModule.postgresClient as any,
  };
}

describe('pg_query / pg_execute sql field handling', () => {
  let postgresClient: any;
  let originalQuery: any;
  let originalQueryWithResult: any;

  beforeAll(async () => {
    (globalThis as any).TextEncoder = TextEncoder;
    (globalThis as any).TextDecoder = TextDecoder;

    const modules = await loadPgModules();
    postgresClient = modules.postgresClient;
    originalQuery = postgresClient.query;
    originalQueryWithResult = postgresClient.queryWithResult;
  });

  afterEach(() => {
    postgresClient.query = originalQuery;
    postgresClient.queryWithResult = originalQueryWithResult;
  });

  it('pg_query accepts query alias and long SQL strings without schema rejection', async () => {
    const { pgQueryModule } = await loadPgModules();

    postgresClient.query = jest.fn(async () => []);

    const worker = configureWorker(new pgQueryModule.PgQueryWorker(), pgQueryModule.pgQueryRegistration);
    const longSql = `SELECT 1 AS one -- ${'x'.repeat(12000)}`;

    const result = await worker.invoke({
      query: longSql,
      params: [],
    });

    expect(result.success).toBe(true);
    expect(postgresClient.query).toHaveBeenCalledTimes(1);
    expect(postgresClient.query).toHaveBeenCalledWith(longSql.trim(), []);
  });

  it('pg_execute accepts statement alias in nested input payloads', async () => {
    const { pgExecuteModule } = await loadPgModules();

    postgresClient.queryWithResult = jest.fn(async () => ({
      command: 'UPDATE',
      rowCount: 1,
      oid: null,
    }));

    const worker = configureWorker(new pgExecuteModule.PgExecuteWorker(), pgExecuteModule.pgExecuteRegistration);

    const result = await worker.invoke({
      input: {
        statement: 'UPDATE test_table SET touched = true WHERE id = 1',
        params: [],
      },
    });

    expect(result.success).toBe(true);
    expect(postgresClient.queryWithResult).toHaveBeenCalledTimes(1);
    expect(postgresClient.queryWithResult).toHaveBeenCalledWith('UPDATE test_table SET touched = true WHERE id = 1', []);
  });

  it('pg_execute reports clear SQL error only when no alias field is present', async () => {
    const { pgExecuteModule } = await loadPgModules();

    const worker = configureWorker(new pgExecuteModule.PgExecuteWorker(), pgExecuteModule.pgExecuteRegistration);
    const result = await worker.invoke({ params: [] });

    expect(result.success).toBe(false);
    expect(result.result as string).toContain('Missing SQL statement');
    expect(result.result as string).not.toContain('Missing required field: sql');
  });
});

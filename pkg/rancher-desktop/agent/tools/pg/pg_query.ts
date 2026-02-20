import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { postgresClient } from "../../database/PostgresClient";

/**
 * Pg Query Tool - Worker class for execution
 */
export class PgQueryWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const sql = String(input.sql ?? input.query ?? input.statement ?? '').trim();
    const params = Array.isArray(input.params) ? input.params : [];

    if (!sql) {
      return {
        successBoolean: false,
        responseString: 'Missing SQL statement. Provide sql (preferred) or query/statement.',
      };
    }

    try {
      const result = await postgresClient.query(sql, params);

      const responseString = `PostgreSQL Query Result:
Rows Returned: ${result.length}
Query Executed Successfully`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing PostgreSQL query: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const pgQueryRegistration: ToolRegistration = {
  name: "pg_query",
  description: "Execute a PostgreSQL query and return results.",
  category: "pg",
  schemaDef: {
    sql: { type: 'string' as const, optional: true, description: "The SQL query to execute" },
    query: { type: 'string' as const, optional: true, description: "Alias for sql" },
    statement: { type: 'string' as const, optional: true, description: "Alias for sql" },
    params: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "Parameters for the query" },
  },
  workerClass: PgQueryWorker,
};

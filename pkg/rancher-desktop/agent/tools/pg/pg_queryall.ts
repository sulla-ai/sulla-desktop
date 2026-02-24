import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { postgresClient } from "../../database/PostgresClient";

/**
 * Pg Query All Tool - Worker class for execution
 */
export class PgQueryAllWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { sql, params = [] } = input;

    try {
      const result = await postgresClient.queryAll(sql, params);
      const rowsJson = JSON.stringify(result, null, 2);

      const responseString = `PostgreSQL QueryAll Result:
Rows Returned: ${result.length}
Rows: ${rowsJson}
Query Executed Successfully`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing PostgreSQL queryAll: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const pgQueryAllRegistration: ToolRegistration = {
  name: "pg_queryall",
  description: "Execute a PostgreSQL query and return all result rows.",
  category: "pg",
  operationTypes: ['read'],
  schemaDef: {
    sql: { type: 'string' as const, description: "The SQL query to execute" },
    params: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "Parameters for the query" },
  },
  workerClass: PgQueryAllWorker,
};

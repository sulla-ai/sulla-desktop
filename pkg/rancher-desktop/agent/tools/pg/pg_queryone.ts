import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { postgresClient } from "../../database/PostgresClient";

/**
 * Pg Query One Tool - Worker class for execution
 */
export class PgQueryOneWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { sql, params = [] } = input;

    try {
      const result = await postgresClient.queryOne(sql, params);
      const rowJson = result ? JSON.stringify(result, null, 2) : 'null';

      const responseString = `PostgreSQL QueryOne Result:
Row Returned: ${result ? 'Yes' : 'No'}
Row: ${rowJson}
Query Executed Successfully`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing PostgreSQL queryOne: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const pgQueryOneRegistration: ToolRegistration = {
  name: "pg_queryone",
  description: "Execute a PostgreSQL query and return the first result row.",
  category: "pg",
  schemaDef: {
    sql: { type: 'string' as const, description: "The SQL query to execute" },
    params: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "Parameters for the query" },
  },
  workerClass: PgQueryOneWorker,
};

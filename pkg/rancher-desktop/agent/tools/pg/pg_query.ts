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
    const { sql, params = [] } = input;

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
    sql: { type: 'string' as const, description: "The SQL query to execute" },
    params: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "Parameters for the query" },
  },
  workerClass: PgQueryWorker,
};

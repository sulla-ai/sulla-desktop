import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { postgresClient } from "../../database/PostgresClient";

/**
 * Pg Count Tool - Worker class for execution
 */
export class PgCountWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { sql, params = [] } = input;

    try {
      const res = await postgresClient.queryOne<{ count: string }>(sql, params);
      const count = res ? parseInt(res.count, 10) : 0;

      return {
        successBoolean: true,
        responseString: `PostgreSQL Count Result: ${count}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing PostgreSQL count query: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const pgCountRegistration: ToolRegistration = {
  name: "pg_count",
  description: "Execute a PostgreSQL count query and return the count.",
  category: "pg",
  schemaDef: {
    sql: { type: 'string' as const, description: "The SQL count query to execute" },
    params: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "Parameters for the query" },
  },
  workerClass: PgCountWorker,
};

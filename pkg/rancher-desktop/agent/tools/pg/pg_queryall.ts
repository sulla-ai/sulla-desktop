import { BaseTool, ToolRegistration } from "../base";
import { postgresClient } from "../../database/PostgresClient";

/**
 * Pg Query All Tool - Worker class for execution
 */
export class PgQueryAllWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { sql, params = [] } = input;

    try {
      const result = await postgresClient.queryAll(sql, params);
      return result;
    } catch (error) {
      return `Error executing PostgreSQL queryAll: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const pgQueryAllRegistration: ToolRegistration = {
  name: "pg_queryall",
  description: "Execute a PostgreSQL query and return all result rows.",
  category: "pg",
  schemaDef: {
    sql: { type: 'string' as const, description: "The SQL query to execute" },
    params: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "Parameters for the query" },
  },
  workerClass: PgQueryAllWorker,
};

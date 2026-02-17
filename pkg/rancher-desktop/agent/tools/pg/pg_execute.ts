import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { postgresClient } from "../../database/PostgresClient";

/**
 * Pg Execute Tool - Worker class for execution
 */
export class PgExecuteWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { sql, params = [] } = input;

    try {
      const res = await postgresClient.queryWithResult(sql, params);

      const responseString = `PostgreSQL Execution Result:
Command: ${res.command}
Rows Affected: ${res.rowCount}
OID: ${res.oid || 'N/A'}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing PostgreSQL statement: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const pgExecuteRegistration: ToolRegistration = {
  name: "pg_execute",
  description: "Execute a PostgreSQL statement and return execution results.",
  category: "pg",
  schemaDef: {
    sql: { type: 'string' as const, description: "The SQL statement to execute" },
    params: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "Parameters for the statement" },
  },
  workerClass: PgExecuteWorker,
};

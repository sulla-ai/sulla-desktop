import { BaseTool } from "../base";
import { z } from "zod";
import { postgresClient } from "../../database/PostgresClient";

export class PgExecuteTool extends BaseTool {
  name = "pg_execute";
  description = "Execute a PostgreSQL statement and return execution results.";
  schema = z.object({
    sql: z.string().describe("The SQL statement to execute"),
    params: z.array(z.any()).optional().describe("Parameters for the statement"),
  });

  metadata = { category: "pg" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { sql, params = [] } = input;

    try {
      const res = await postgresClient.queryWithResult(sql, params);
      return {
        rowCount: res.rowCount,
        command: res.command,
        oid: res.oid,
      };
    } catch (error) {
      return `Error executing PostgreSQL statement: ${(error as Error).message}`;
    }
  }
}

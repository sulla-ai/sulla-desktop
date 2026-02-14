import { BaseTool } from "../base";
import { z } from "zod";
import { postgresClient } from "../../database/PostgresClient";

export class PgQueryAllTool extends BaseTool {
  name = "pg_queryall";
  description = "Execute a PostgreSQL query and return all result rows.";
  schema = z.object({
    sql: z.string().describe("The SQL query to execute"),
    params: z.array(z.any()).optional().describe("Parameters for the query"),
  });

  metadata = { category: "pg" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { sql, params = [] } = input;

    try {
      const result = await postgresClient.queryAll(sql, params);
      return result;
    } catch (error) {
      return `Error executing PostgreSQL queryAll: ${(error as Error).message}`;
    }
  }
}

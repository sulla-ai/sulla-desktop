import { BaseTool } from "../base";
import { z } from "zod";
import { postgresClient } from "../../database/PostgresClient";

export class PgQueryTool extends BaseTool {
  name = "pg_query";
  description = "Execute a PostgreSQL query and return results.";
  schema = z.object({
    sql: z.string().describe("The SQL query to execute"),
    params: z.array(z.any()).optional().describe("Parameters for the query"),
  });

  metadata = { category: "pg" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { sql, params = [] } = input;

    try {
      const result = await postgresClient.query(sql, params);
      return result;
    } catch (error) {
      return `Error executing PostgreSQL query: ${(error as Error).message}`;
    }
  }
}

import { BaseTool } from "../base";
import { z } from "zod";
import { postgresClient } from "../../database/PostgresClient";

export class PostgresQueryOneTool extends BaseTool {
  name = "postgres_queryone";
  description = "Execute a PostgreSQL query and return the first result row.";
  schema = z.object({
    sql: z.string().describe("The SQL query to execute"),
    params: z.array(z.any()).optional().describe("Parameters for the query"),
  });

  metadata = { category: "postgres" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { sql, params = [] } = input;

    try {
      const result = await postgresClient.queryOne(sql, params);
      return result;
    } catch (error) {
      return `Error executing PostgreSQL queryOne: ${(error as Error).message}`;
    }
  }
}

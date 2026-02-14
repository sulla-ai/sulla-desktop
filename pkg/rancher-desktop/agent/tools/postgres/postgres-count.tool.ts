import { BaseTool } from "../base";
import { z } from "zod";
import { postgresClient } from "../../database/PostgresClient";

export class PostgresCountTool extends BaseTool {
  name = "postgres_count";
  description = "Execute a PostgreSQL count query and return the count.";
  schema = z.object({
    sql: z.string().describe("The SQL count query to execute"),
    params: z.array(z.any()).optional().describe("Parameters for the query"),
  });

  metadata = { category: "postgres" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { sql, params = [] } = input;

    try {
      const res = await postgresClient.queryOne<{ count: string }>(sql, params);
      const count = res ? parseInt(res.count, 10) : 0;
      return { count };
    } catch (error) {
      return `Error executing PostgreSQL count query: ${(error as Error).message}`;
    }
  }
}

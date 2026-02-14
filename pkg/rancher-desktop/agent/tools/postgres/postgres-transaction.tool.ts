import { BaseTool } from "../base";
import { z } from "zod";
import { postgresClient } from "../../database/PostgresClient";

export class PostgresTransactionTool extends BaseTool {
  name = "postgres_transaction";
  description = "Execute multiple PostgreSQL statements in a transaction.";
  schema = z.object({
    sql: z.string().describe("SQL statements separated by semicolons to execute in a transaction"),
  });

  metadata = { category: "postgres" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { sql } = input;

    try {
      const sqlStatements = sql.split(';').map(s => s.trim()).filter(Boolean);
      if (!sqlStatements.length) throw new Error('No statements');

      const result = await postgresClient.transaction(async (tx) => {
        const results: any[] = [];
        for (const stmt of sqlStatements) {
          if (!stmt) continue;
          const res = await tx.query(stmt);
          results.push({
            command: res.command,
            rowCount: res.rowCount,
          });
        }
        return results;
      });

      return result;
    } catch (error) {
      return `Error executing PostgreSQL transaction: ${(error as Error).message}`;
    }
  }
}

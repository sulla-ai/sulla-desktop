import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { postgresClient } from "../../database/PostgresClient";

/**
 * Pg Transaction Tool - Worker class for execution
 */
export class PgTransactionWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { sql } = input;

    try {
      const sqlStatements = sql.split(';').map((s: string) => s.trim()).filter(Boolean);
      if (!sqlStatements.length) {
        return {
          successBoolean: false,
          responseString: 'No SQL statements provided for transaction.'
        };
      }

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

      const responseString = `PostgreSQL Transaction Executed Successfully:
Statements Executed: ${result.length}
Results: ${result.map(r => `${r.command} (${r.rowCount} rows)`).join(', ')}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing PostgreSQL transaction: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const pgTransactionRegistration: ToolRegistration = {
  name: "pg_transaction",
  description: "Execute multiple PostgreSQL statements in a transaction.",
  category: "pg",
  operationTypes: ['execute'],
  schemaDef: {
    sql: { type: 'string' as const, description: "SQL statements separated by semicolons to execute in a transaction" },
  },
  workerClass: PgTransactionWorker,
};

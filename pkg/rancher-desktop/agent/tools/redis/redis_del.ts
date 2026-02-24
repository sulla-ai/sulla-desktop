import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Del Tool - Worker class for execution
 */
export class RedisDelWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { keys } = input;

    try {
      const count = await redisClient.del(keys);

      return {
        successBoolean: true,
        responseString: `Redis DEL: ${count} key(s) deleted (${keys.join(', ')})`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error deleting Redis keys: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const redisDelRegistration: ToolRegistration = {
  name: "redis_del",
  description: "Delete one or more Redis keys.",
  category: "redis",
  operationTypes: ['execute'],
  schemaDef: {
    keys: { type: 'array' as const, items: { type: 'string' as const }, description: "The Redis keys to delete" },
  },
  workerClass: RedisDelWorker,
};

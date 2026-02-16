import { BaseTool, ToolRegistration } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Hget Tool - Worker class for execution
 */
export class RedisHgetWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { key, field } = input;

    try {
      const value = await redisClient.hget(key, field);
      return value;
    } catch (error) {
      return `Error getting Redis hash field: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const redisHgetRegistration: ToolRegistration = {
  name: "redis_hget",
  description: "Get the value of a field in a Redis hash.",
  category: "redis",
  schemaDef: {
    key: { type: 'string' as const, description: "The Redis hash key" },
    field: { type: 'string' as const, description: "The field in the hash" },
  },
  workerClass: RedisHgetWorker,
};

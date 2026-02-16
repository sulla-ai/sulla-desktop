import { BaseTool, ToolRegistration } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Lpop Tool - Worker class for execution
 */
export class RedisLpopWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { key } = input;

    try {
      const value = await redisClient.lpop(key);
      return value;
    } catch (error) {
      return `Error popping from Redis list: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const redisLpopRegistration: ToolRegistration = {
  name: "redis_lpop",
  description: "Remove and return the first element of a Redis list.",
  category: "redis",
  schemaDef: {
    key: { type: 'string' as const, description: "The Redis list key" },
  },
  workerClass: RedisLpopWorker,
};

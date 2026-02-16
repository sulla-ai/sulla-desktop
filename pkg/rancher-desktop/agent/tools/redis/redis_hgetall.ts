import { BaseTool, ToolRegistration } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Hgetall Tool - Worker class for execution
 */
export class RedisHgetallWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { key } = input;

    try {
      const obj = await redisClient.hgetall(key);
      return obj;
    } catch (error) {
      return `Error getting Redis hash: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const redisHgetallRegistration: ToolRegistration = {
  name: "redis_hgetall",
  description: "Get all fields and values from a Redis hash.",
  category: "redis",
  schemaDef: {
    key: { type: 'string' as const, description: "The Redis hash key" },
  },
  workerClass: RedisHgetallWorker,
};

import { BaseTool, ToolRegistration } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Incr Tool - Worker class for execution
 */
export class RedisIncrWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { key } = input;

    try {
      const newValue = await redisClient.incr(key);
      return newValue;
    } catch (error) {
      return `Error incrementing Redis key: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const redisIncrRegistration: ToolRegistration = {
  name: "redis_incr",
  description: "Increment the integer value of a Redis key by one.",
  category: "redis",
  schemaDef: {
    key: { type: 'string' as const, description: "The Redis key to increment" },
  },
  workerClass: RedisIncrWorker,
};

import { BaseTool, ToolRegistration } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Decr Tool - Worker class for execution
 */
export class RedisDecrWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { key } = input;

    try {
      const newValue = await redisClient.decr(key);
      return newValue;
    } catch (error) {
      return `Error decrementing Redis key: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const redisDecrRegistration: ToolRegistration = {
  name: "redis_decr",
  description: "Decrement the integer value of a Redis key by one.",
  category: "redis",
  schemaDef: {
    key: { type: 'string' as const, description: "The Redis key to decrement" },
  },
  workerClass: RedisDecrWorker,
};

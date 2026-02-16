import { BaseTool, ToolRegistration } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Get Tool - Worker class for execution
 */
export class RedisGetWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { key } = input;

    try {
      const value = await redisClient.get(key);
      return value;
    } catch (error) {
      return `Error getting Redis key: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const redisGetRegistration: ToolRegistration = {
  name: "redis_get",
  description: "Get the value of a Redis key.",
  category: "redis",
  schemaDef: {
    key: { type: 'string' as const, description: "The Redis key to get" },
  },
  workerClass: RedisGetWorker,
};

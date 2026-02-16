import { BaseTool, ToolRegistration } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Ttl Tool - Worker class for execution
 */
export class RedisTtlWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { key } = input;

    try {
      const seconds = await redisClient.ttl(key);
      return seconds;
    } catch (error) {
      return `Error getting Redis key TTL: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const redisTtlRegistration: ToolRegistration = {
  name: "redis_ttl",
  description: "Get the time to live (TTL) of a Redis key.",
  category: "redis",
  schemaDef: {
    key: { type: 'string' as const, description: "The Redis key to check TTL for" },
  },
  workerClass: RedisTtlWorker,
};

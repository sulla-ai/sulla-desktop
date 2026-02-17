import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Ttl Tool - Worker class for execution
 */
export class RedisTtlWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { key } = input;

    try {
      const seconds = await redisClient.ttl(key);

      return {
        successBoolean: true,
        responseString: `Redis TTL for ${key}: ${seconds === -2 ? 'Key does not exist' : seconds === -1 ? 'No expiration' : `${seconds} seconds`}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting Redis key TTL: ${(error as Error).message}`
      };
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

import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Set Tool - Worker class for execution
 */
export class RedisSetWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { key, value, ttl } = input;

    try {
      await redisClient.set(key, value, ttl);

      return {
        successBoolean: true,
        responseString: `Redis SET ${key} = "${value}"${ttl ? ` (TTL: ${ttl}s)` : ''}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error setting Redis key: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const redisSetRegistration: ToolRegistration = {
  name: "redis_set",
  description: "Set the value of a Redis key.",
  category: "redis",
  operationTypes: ['update'],
  schemaDef: {
    key: { type: 'string' as const, description: "The Redis key to set" },
    value: { type: 'string' as const, description: "The value to set" },
    ttl: { type: 'number' as const, optional: true, description: "Time to live in seconds" },
  },
  workerClass: RedisSetWorker,
};

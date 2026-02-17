import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Expire Tool - Worker class for execution
 */
export class RedisExpireWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { key, seconds } = input;

    try {
      const result = await redisClient.expire(key, seconds);

      return {
        successBoolean: true,
        responseString: `Redis EXPIRE ${key}: ${result === 1 ? `expiration set to ${seconds} seconds` : 'key does not exist or already has expiration'}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error setting Redis key expiration: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const redisExpireRegistration: ToolRegistration = {
  name: "redis_expire",
  description: "Set a timeout on a Redis key.",
  category: "redis",
  schemaDef: {
    key: { type: 'string' as const, description: "The Redis key to set expiration on" },
    seconds: { type: 'number' as const, description: "The expiration time in seconds" },
  },
  workerClass: RedisExpireWorker,
};

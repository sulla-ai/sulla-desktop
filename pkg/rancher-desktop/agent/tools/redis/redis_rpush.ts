import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Rpush Tool - Worker class for execution
 */
export class RedisRpushWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { key, values } = input;

    try {
      const length = await redisClient.rpush(key, ...values);

      return {
        successBoolean: true,
        responseString: `Redis RPUSH ${key}: appended ${values.length} values, new length is ${length}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error appending to Redis list: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const redisRpushRegistration: ToolRegistration = {
  name: "redis_rpush",
  description: "Append one or more values to a Redis list.",
  category: "redis",
  operationTypes: ['execute'],
  schemaDef: {
    key: { type: 'string' as const, description: "The Redis list key" },
    values: { type: 'array' as const, items: { type: 'string' as const }, description: "The values to append" },
  },
  workerClass: RedisRpushWorker,
};

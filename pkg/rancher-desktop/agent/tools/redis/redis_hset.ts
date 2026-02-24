import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { redisClient } from "../../database/RedisClient";

/**
 * Redis Hset Tool - Worker class for execution
 */
export class RedisHsetWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { key, field, value } = input;

    try {
      const count = await redisClient.hset(key, field, value);

      return {
        successBoolean: true,
        responseString: `Redis HSET ${key} ${field} = "${value}" (${count === 1 ? 'new field' : 'existing field updated'})`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error setting Redis hash field: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const redisHsetRegistration: ToolRegistration = {
  name: "redis_hset",
  description: "Set the value of a field in a Redis hash.",
  category: "redis",
  operationTypes: ['execute'],
  schemaDef: {
    key: { type: 'string' as const, description: "The Redis hash key" },
    field: { type: 'string' as const, description: "The field in the hash" },
    value: { type: 'string' as const, description: "The value to set" },
  },
  workerClass: RedisHsetWorker,
};

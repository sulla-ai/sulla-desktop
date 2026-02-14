import { BaseTool } from "../base";
import { z } from "zod";
import { redisClient } from "../../database/RedisClient";

export class RedisHsetTool extends BaseTool {
  name = "redis_hset";
  description = "Set the value of a field in a Redis hash.";
  schema = z.object({
    key: z.string().describe("The Redis hash key"),
    field: z.string().describe("The field in the hash"),
    value: z.any().describe("The value to set"),
  });

  metadata = { category: "redis" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { key, field, value } = input;

    try {
      const count = await redisClient.hset(key, field, value);
      return count;
    } catch (error) {
      return `Error setting Redis hash field: ${(error as Error).message}`;
    }
  }
}

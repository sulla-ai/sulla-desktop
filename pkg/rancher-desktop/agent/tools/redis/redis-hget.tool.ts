import { BaseTool } from "../base";
import { z } from "zod";
import { redisClient } from "../../database/RedisClient";

export class RedisHgetTool extends BaseTool {
  name = "redis_hget";
  description = "Get the value of a field in a Redis hash.";
  schema = z.object({
    key: z.string().describe("The Redis hash key"),
    field: z.string().describe("The field in the hash"),
  });

  metadata = { category: "redis" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { key, field } = input;

    try {
      const value = await redisClient.hget(key, field);
      return value;
    } catch (error) {
      return `Error getting Redis hash field: ${(error as Error).message}`;
    }
  }
}

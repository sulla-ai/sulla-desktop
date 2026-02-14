import { BaseTool } from "../base";
import { z } from "zod";
import { redisClient } from "../../database/RedisClient";

export class RedisIncrTool extends BaseTool {
  name = "redis_incr";
  description = "Increment the integer value of a Redis key by one.";
  schema = z.object({
    key: z.string().describe("The Redis key to increment"),
  });

  metadata = { category: "redis" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { key } = input;

    try {
      const newValue = await redisClient.incr(key);
      return newValue;
    } catch (error) {
      return `Error incrementing Redis key: ${(error as Error).message}`;
    }
  }
}

import { BaseTool } from "../base";
import { z } from "zod";
import { redisClient } from "../../database/RedisClient";

export class RedisLpopTool extends BaseTool {
  name = "redis_lpop";
  description = "Remove and return the first element of a Redis list.";
  schema = z.object({
    key: z.string().describe("The Redis list key"),
  });

  metadata = { category: "redis" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { key } = input;

    try {
      const value = await redisClient.lpop(key);
      return value;
    } catch (error) {
      return `Error popping from Redis list: ${(error as Error).message}`;
    }
  }
}

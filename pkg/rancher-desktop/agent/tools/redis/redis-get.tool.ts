import { BaseTool } from "../base";
import { z } from "zod";
import { redisClient } from "../../database/RedisClient";

export class RedisGetTool extends BaseTool {
  name = "redis_get";
  description = "Get the value of a Redis key.";
  schema = z.object({
    key: z.string().describe("The Redis key to get"),
  });

  metadata = { category: "redis" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { key } = input;

    try {
      const value = await redisClient.get(key);
      return value;
    } catch (error) {
      return `Error getting Redis key: ${(error as Error).message}`;
    }
  }
}

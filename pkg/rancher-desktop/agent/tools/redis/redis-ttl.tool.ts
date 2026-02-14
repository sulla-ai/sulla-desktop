import { BaseTool } from "../base";
import { z } from "zod";
import { redisClient } from "../../database/RedisClient";

export class RedisTtlTool extends BaseTool {
  name = "redis_ttl";
  description = "Get the time to live (TTL) of a Redis key.";
  schema = z.object({
    key: z.string().describe("The Redis key to check TTL for"),
  });

  metadata = { category: "redis" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { key } = input;

    try {
      const seconds = await redisClient.ttl(key);
      return seconds;
    } catch (error) {
      return `Error getting Redis key TTL: ${(error as Error).message}`;
    }
  }
}

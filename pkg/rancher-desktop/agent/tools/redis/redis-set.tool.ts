import { BaseTool } from "../base";
import { z } from "zod";
import { redisClient } from "../../database/RedisClient";

export class RedisSetTool extends BaseTool {
  name = "redis_set";
  description = "Set the value of a Redis key.";
  schema = z.object({
    key: z.string().describe("The Redis key to set"),
    value: z.any().describe("The value to set"),
    ttl: z.number().optional().describe("Time to live in seconds"),
  });

  metadata = { category: "redis" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { key, value, ttl } = input;

    try {
      await redisClient.set(key, value, ttl);
      return 'OK';
    } catch (error) {
      return `Error setting Redis key: ${(error as Error).message}`;
    }
  }
}

import { BaseTool } from "../base";
import { z } from "zod";
import { redisClient } from "../../database/RedisClient";

export class RedisExpireTool extends BaseTool {
  name = "redis_expire";
  description = "Set a timeout on a Redis key.";
  schema = z.object({
    key: z.string().describe("The Redis key to set expiration on"),
    seconds: z.number().describe("The expiration time in seconds"),
  });

  metadata = { category: "redis" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { key, seconds } = input;

    try {
      const result = await redisClient.expire(key, seconds);
      return result === 1;
    } catch (error) {
      return `Error setting Redis key expiration: ${(error as Error).message}`;
    }
  }
}

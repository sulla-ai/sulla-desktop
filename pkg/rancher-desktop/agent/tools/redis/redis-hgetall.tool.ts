import { BaseTool } from "../base";
import { z } from "zod";
import { redisClient } from "../../database/RedisClient";

export class RedisHgetallTool extends BaseTool {
  name = "redis_hgetall";
  description = "Get all fields and values from a Redis hash.";
  schema = z.object({
    key: z.string().describe("The Redis hash key"),
  });

  metadata = { category: "redis" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { key } = input;

    try {
      const obj = await redisClient.hgetall(key);
      return obj;
    } catch (error) {
      return `Error getting Redis hash: ${(error as Error).message}`;
    }
  }
}

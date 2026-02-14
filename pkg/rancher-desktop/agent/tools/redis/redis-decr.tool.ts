import { BaseTool } from "../base";
import { z } from "zod";
import { redisClient } from "../../database/RedisClient";

export class RedisDecrTool extends BaseTool {
  name = "redis_decr";
  description = "Decrement the integer value of a Redis key by one.";
  schema = z.object({
    key: z.string().describe("The Redis key to decrement"),
  });

  metadata = { category: "redis" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { key } = input;

    try {
      const newValue = await redisClient.decr(key);
      return newValue;
    } catch (error) {
      return `Error decrementing Redis key: ${(error as Error).message}`;
    }
  }
}

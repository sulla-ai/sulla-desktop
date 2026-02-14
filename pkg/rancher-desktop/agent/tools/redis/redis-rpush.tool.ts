import { BaseTool } from "../base";
import { z } from "zod";
import { redisClient } from "../../database/RedisClient";

export class RedisRpushTool extends BaseTool {
  name = "redis_rpush";
  description = "Append one or more values to a Redis list.";
  schema = z.object({
    key: z.string().describe("The Redis list key"),
    values: z.array(z.any()).describe("The values to append"),
  });

  metadata = { category: "redis" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { key, values } = input;

    try {
      const length = await redisClient.rpush(key, ...values);
      return length;
    } catch (error) {
      return `Error appending to Redis list: ${(error as Error).message}`;
    }
  }
}

import { BaseTool } from "../base";
import { z } from "zod";
import { redisClient } from "../../database/RedisClient";

export class RedisDelTool extends BaseTool {
  name = "redis_del";
  description = "Delete one or more Redis keys.";
  schema = z.object({
    keys: z.array(z.string()).describe("The Redis keys to delete"),
  });

  metadata = { category: "redis" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { keys } = input;

    try {
      const count = await redisClient.del(...keys);
      return { deleted: count };
    } catch (error) {
      return `Error deleting Redis keys: ${(error as Error).message}`;
    }
  }
}

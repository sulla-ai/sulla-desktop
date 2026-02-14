import { BaseTool } from "../base";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

import { toolRegistry } from "../registry";

export class InstallSkillTool extends BaseTool {
  name = "install_skill";
  description = "Install a new skill/tool from GitHub repo, npm package, or direct git clone URL. Installed skill becomes immediately available.";
  schema = z.object({
    source: z.string().describe("GitHub repo URL, npm package name, or git clone URL"),
    name: z.string().optional().describe("Desired folder/tool name (defaults to repo/package name)"),
    category: z.string().optional().default("custom").describe("Category to place the tool in"),
  });

  metadata = { category: "meta", requiresApproval: true };

  protected async _call(input: z.infer<this["schema"]>) {
    const { source, name: customName, category } = input;

    const skillsDir = path.join(process.cwd(), "src/tools/skills");
    await fs.mkdir(skillsDir, { recursive: true });

    const toolName = customName || source.split("/").pop()?.replace(".git", "") || "unnamed-skill";
    const targetDir = path.join(skillsDir, toolName);

    try {
      // Simple git clone support for now (expand later for npm, tarballs, etc.)
      if (source.includes("github.com") || source.endsWith(".git")) {
        await execAsync(`git clone ${source} "${targetDir}"`);
      } else {
        return `Unsupported source format: ${source}. Currently only git URLs are supported.`;
      }

      // Attempt to dynamically import the new tool
      const toolPath = path.join(targetDir, "index.ts"); // assume skill exports default BaseTool
      const loaded = require(toolPath);
      const NewToolClass = loaded.default || loaded.Tool;

      if (typeof NewToolClass !== "function") {
        return `Installed ${toolName} but no valid tool class exported from ${toolPath}`;
      }

      const instance = new NewToolClass();
      instance.metadata.category = category;
      toolRegistry.addTool(instance);

      return `Skill "${toolName}" installed into category "${category}" and registered. You can now use tool: ${instance.name}`;
    } catch (err: any) {
      return `Installation failed: ${err.message}`;
    }
  }
}

toolRegistry.registerLazy('install_skill', async () => new InstallSkillTool(), 'meta');
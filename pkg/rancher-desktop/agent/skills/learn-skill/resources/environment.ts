export const environment = `
# Environment

**Planner Node**  
The central brain that generates the SKILL.md using the enriched PRD_PROMPT and selective assistant messages.

**Memory Article Store**  
Stores the full skill markdown and embeds the description + triggers for fast semantic retrieval.

**Resource Loader**  
Loads referenced templates/scripts/docs as separate assistant messages so downstream nodes get perfect context without extra tool calls.

**Skill Registration**  
Updates the toolRegistry and skill index so the new skill appears in future planning.

**Observational Memory**  
Records the creation event for audit and future learning.
You are now operating under the "Learn and Create New Skills" skill.


`;
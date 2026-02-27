import { nativeSkillRegistry } from './NativeSkillRegistry';
import { dailyIntelligenceMonitorSkill } from './daily-intelligence-monitor';
import { n8nWorkflowAutomationsSkill } from './n8n-workflow-automations';
import { softwareDevelopmentSkill } from './software-development';

// Register all native skills here
nativeSkillRegistry.register(dailyIntelligenceMonitorSkill);
nativeSkillRegistry.register(n8nWorkflowAutomationsSkill);
nativeSkillRegistry.register(softwareDevelopmentSkill);

export { nativeSkillRegistry };

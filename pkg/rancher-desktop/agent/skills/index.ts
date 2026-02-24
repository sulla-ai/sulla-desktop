import { skillLearningSkills } from './learn-skill/skill';
import { sopN8nWorkflowCreation } from './n8n-workflow-automations/skill';
import { sopSoftwareDevelopment } from './software-development/skill';
import { environment as softwareDevelopmentEnvironment } from './software-development/resources/environment';
import { saas_framework } from './software-development/resources/saas_framework';
import { sulla_plugin_development } from './software-development/resources/sulla_plugin_development';
import { prd as softwareDevelopmentPrd } from './software-development/templates/prd';
import { environment as learnSkillEnvironment } from './learn-skill/resources/environment';
import { environment as n8nWorkflowEnvironment } from './n8n-workflow-automations/resources/environment';
import { example_1 as n8nWorkflowExample1 } from './n8n-workflow-automations/resources/example_1';
import { example_2 as n8nWorkflowExample2 } from './n8n-workflow-automations/resources/example_2';
import { example_3 as n8nWorkflowExample3 } from './n8n-workflow-automations/resources/example_3';
import { example_4 as n8nWorkflowExample4 } from './n8n-workflow-automations/resources/example_4';
import { prd as n8nWorkflowPrd } from './n8n-workflow-automations/templates/prd';

export type HardcodedSkillResourceMap = Record<string, string>;

export const hardcodedSkills = {
  skillLearningSkills,
  sopSoftwareDevelopment,
  sopN8nWorkflowCreation,
};

export const hardcodedSkillResourcesBySlug: Record<string, HardcodedSkillResourceMap> = {
  'skill-learn-and-create-new-skills': {
    'skills/learn-skill/resources/environment.ts': learnSkillEnvironment,
  },
  'sop-software-development': {
    'skills/software-development/templates/prd.ts': softwareDevelopmentPrd,
    'skills/software-development/resources/environment.ts': softwareDevelopmentEnvironment,
    'skills/software-development/resources/saas_framework.ts': saas_framework,
    'skills/software-development/resources/sulla_plugin_development.ts': sulla_plugin_development,
  },
  'skill-n8n-workflow-creation': {
    'skills/n8n-workflow-automations/templates/prd.ts': n8nWorkflowPrd,
    'skills/n8n-workflow-automations/resources/environment.ts': n8nWorkflowEnvironment,
    'skills/n8n-workflow-automations/resources/example_1.ts': n8nWorkflowExample1,
    'skills/n8n-workflow-automations/resources/example_2.ts': n8nWorkflowExample2,
    'skills/n8n-workflow-automations/resources/example_3.ts': n8nWorkflowExample3,
    'skills/n8n-workflow-automations/resources/example_4.ts': n8nWorkflowExample4,
  },
};

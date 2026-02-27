import type { NativeSkillDefinition } from './NativeSkillRegistry';

const SKILL_DOC = `---
schemaversion: 1
slug: skill-n8n-workflow-creation
title: "Create n8n Automation Workflow"
section: Standard Operating Procedures
category: Automation
tags:
  - skill
  - n8n
  - workflows
  - automation
order: 6
locked: true
author: seed
---

# Skill Manifest: Create n8n Automation Workflow

**Project article slug** = workflow-{purpose-kebab}

**Triggers**: Human says "build workflow", "create automation for", "set up n8n to do", "create n8n workflow", "automation for".

## Description

We have n8n installed as a docker container, it's our preferred system for setting up automations/workflows.

## Environment

### n8n
- n8n is installed locally on docker.
- n8n dashboard: http://127.0.0.1:30119
- n8n has a full API. Native tools are built around the n8n API in the n8n tool category.
- n8n is installed into the postgres database. Native pg tools are available.
- n8n operations are stateful — creating or updating workflows and credentials changes persisted data.
- Workflow payloads follow the n8n structure: nodes array, connections object, settings object.

### Node-specific workflow editing tools
- patch_workflow is the unified mutation tool for node and connection deltas (sequential, atomic).
- get_workflow_node_list returns lightweight node list + edge map.
- get_workflow_node returns node details by nodeId or nodeName.
- patch_workflow supports node operations: add, update, remove and connection operations: add, remove.

### Active Sidebar Elements
- Use manage_active_asset to create/update/remove active elements (iframe, document).
- For workflow SPA display, use the resolved stable workflow asset ID.
- Keep URL on the workflow app main/base route only.

### Chat Completions Endpoint
- Local: http://localhost:3000/v1/chat/completions
- Docker: http://host.docker.internal:3000/v1/chat/completions
- No authentication required.

### Integration Credentials
- integration_get_credentials returns connection status and stored values.
- n8n credentials managed through local credentials entity store.
- get_credentials lists, create_credential adds.

## Planner

After the universal core PRD sections (YAML frontmatter + Goal through What Has Been Tried), you MUST include:

- **Requirements** — Trigger type, Error handling strategy
- **Credential Resolution** — Markdown table: Integration | Required | Status | Notes
- **Workflow Details** — Workflow name, High-level node flow, Total nodes and connections
- **Execution Steps** — Incremental build plan, each step verified with get_workflow / get_workflow_node_list before proceeding

## Execution Pattern

Each workflow is built incrementally:
1. Create empty workflow with basic settings
2. Add trigger node + verify
3. Add processing nodes one at a time, verify each
4. Add error handling + fallback
5. Validate full payload, activate, run manual test

Each step must be completed and verified before the next begins.
`;

export const n8nWorkflowAutomationsSkill: NativeSkillDefinition = {
  name: 'n8n-workflow-automations',
  description: 'Create, debug, and manage n8n automation workflows. Includes environment context, PRD structure, and execution pattern.',
  tags: ['n8n', 'automation', 'workflow', 'skill', 'docker', 'prd'],
  version: '1.0',
  async func() {
    return SKILL_DOC;
  },
};

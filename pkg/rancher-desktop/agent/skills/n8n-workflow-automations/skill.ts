export const sopN8nWorkflowCreation = `---
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
created_at: 2026-02-16T12:33:00Z
updated_at: 2026-02-16T12:33:00Z
mentions:
  - gettingstarted
  - memory-and-dreaming
related_entities:
   - AI Agent
   - Productivity
   - Automation
---

# Skill Manifest: Create n8n Automation Workflow

**Project article slug** = workflow-{purpose-kebab}

**Triggers**: Human says "build workflow", "create automation for", "set up n8n to do", "create n8n workflow", "automation for".

## Description

We have n8n installed as a docker container, it's our preferred system for setting up automations/workflows.

## Planner

After the 9 universal core sections (YAML frontmatter + Ultimate Project Goal through What Has Been Tried and Didn't Work), you MUST include the following sections:

- **Requirements**
  - Trigger type
  - Error handling strategy

- **Credential Resolution**
  - Markdown table showing every required integration, whether it is required, current status (Ready / Missing / Needs owner), and action needed

- **Workflow Details**
  - Workflow name
  - High-level node flow summary
  - Total nodes and connections

`;
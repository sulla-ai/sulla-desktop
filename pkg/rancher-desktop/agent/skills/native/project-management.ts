import type { NativeSkillDefinition } from './NativeSkillRegistry';

export const projectManagementSkill: NativeSkillDefinition = {
  name: 'project-management',
  description: 'SOP for creating, managing, and maintaining projects using the project system — includes size-adaptive PRD templates, README conventions, and lifecycle workflow',
  tags: ['project', 'prd', 'management', 'sop', 'planning', 'requirements', 'document'],
  version: '2.0',
  async func(_input) {
    return `# Project Management — Standard Operating Procedure

## Overview
The project system manages structured workspaces with a \`PROJECT.md\` file (the PRD — full project resource document) and a \`README.md\` (getting started / structure overview). Projects live in workspace folders under \`~/sulla/projects/\`.

**One size does not fit all.** A small task gets a small PRD. A large task gets a comprehensive PRD. Choose the right template tier based on complexity.

## Tools Available
- **search_projects** — Search by name, description, status, or tags (always available in meta category)
- **load_project** — Load the full PROJECT.md content for a project
- **create_project** — Create a new project folder with PROJECT.md + README.md scaffold
- **update_project** — Overwrite the entire PROJECT.md
- **patch_project** — Update a specific markdown section without rewriting the whole file
- **delete_project** — Remove a project folder

## Project Lifecycle

### 1. Discovery
Always start by searching for existing projects:
\`\`\`
search_projects("relevant keywords")
\`\`\`

### 2. Size Assessment
Before creating a PRD, classify the task:
- **Small** — Single-step or trivial task (a quick config change, a bug fix, a one-liner). Use the Minimal PRD.
- **Medium** — Multi-step task with clear scope (a feature, a script, a single integration). Use the Standard PRD.
- **Large** — Complex multi-system project (multiple integrations, research, architecture decisions, credentials, templates). Use the Full PRD.

### 3. Creation
Use \`create_project\` with the appropriately sized template. The \`project_name\` parameter becomes the folder name (use kebab-case).

### 4. Iteration
Use \`patch_project\` for incremental updates to specific sections (e.g., updating the Execution Checklist, adding User Stories). This avoids rewriting the entire file.

### 5. Full Updates
Use \`update_project\` only when the entire document needs restructuring.

### 6. Completion
Update the status field to "completed" via \`patch_project\` or \`update_project\`.

---

## PRD Template Tier 1: Minimal (Small Tasks)

Use for: bug fixes, config changes, quick scripts, single-file edits.

\`\`\`
---
schemaversion: 1
slug: fix-thing-name
title: "Fix/Change Brief Title"
section: Projects
category: "relevant category"
tags:
  - project
  - quick-fix
owner: sulla
status: active
start_date: YYYY-MM-DD
workspace_path: /path/to/workspace
---

# Fix/Change Brief Title

**Goal**: One-sentence goal.

**Owner**: sulla
**Status**: active

## Must Haves
- The one or two things that must happen

## Execution Checklist
- [ ] Step 1
- [ ] Step 2
\`\`\`

---

## PRD Template Tier 2: Standard (Medium Tasks)

Use for: features, scripts, single integrations, moderate scope work.

\`\`\`
---
schemaversion: 1
slug: feature-name
title: "Feature Title"
section: Projects
category: "relevant category"
tags:
  - project
  - relevant-tags
owner: sulla
status: active
start_date: YYYY-MM-DD
workspace_path: /path/to/workspace
github_url: https://github.com/org/repo
---

# Feature Title

**Ultimate Project Goal**: One or two sentences describing the end state.

**Owner**: sulla
**Start Date**: YYYY-MM-DD
**Status**: active

## User Stories
- As a ..., I want ..., so that ...

## Must Haves
- ...

## Should Haves
- ...

## Nice-to-Haves
- ...

## What Has Been Tried and Didn't Work
None documented yet.

## Architecture
- ...

## Execution Checklist
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3
\`\`\`

---

## PRD Template Tier 3: Full (Large/Complex Projects)

Use for: multi-system integrations, automation workflows, projects requiring credential resolution, template research, multiple teams or services.

\`\`\`
---
schemaversion: 1
slug: project-name
title: "Project Title"
section: Projects
category: "relevant category"
tags:
  - project
  - relevant-tags
order: 5
locked: false
author: sulla
created_at: YYYY-MM-DDTHH:MM:SSZ
updated_at: YYYY-MM-DDTHH:MM:SSZ
mentions:
  - related-concept
related_entities:
  - Related System
---

# Project Title

**Ultimate Project Goal**: Comprehensive description of what success looks like — cover all integrations, data flows, and end-user outcomes.

**Owner**: Name
**Start Date**: YYYY-MM-DD

**User Stories**
- As a ..., I want ..., so that ...
- As a ..., I want ..., so that ...
- As a ..., I want ..., so that ...

**Checklist of Completed Items**
None documented yet.

**Must Haves**
- ...

**Should Haves**
- ...

**Nice-to-Haves**
- ...

**What Has Been Tried and Didn't Work**
None documented yet.

## Requirements
- **Trigger type**: (webhook, cron, manual, event-based)
- **Error handling**: Describe retry logic, alerting, and partial-failure strategy.

## Template Research
- Categories explored: ...
- Search queries used: ...
- Top candidates:
  - Template ID XXXXX: "Name" (fit X/10 — reasoning)
  - Template ID XXXXX: "Name" (fit X/10 — reasoning)
- Selected template: Template ID XXXXX ("Name")
- Rationale: Why this template was chosen and what modifications are needed.

## Credential Resolution
| Integration   | Required | Status     | Notes / Action Needed                  |
|---------------|----------|------------|----------------------------------------|
| Service A     | Yes      | Ready      | API key configured                     |
| Service B     | Yes      | Missing    | Need user to provide credentials       |

## Workflow Details
- **Workflow name**: project-name
- **High-level node flow**: Step A → Step B → Step C → Step D
- **Nodes**: N | **Connections**: M

## Architecture
- System diagram or description of how components interact
- Data flow description
- Key technical decisions and rationale

## Execution Checklist
- [ ] Health check passed
- [ ] Project article created
- [ ] Requirements documented
- [ ] Template research completed
- [ ] Credentials resolved
- [ ] Implementation started
- [ ] Core functionality working
- [ ] Full test run completed successfully
- [ ] Project article fully updated
- [ ] Delivery confirmed
\`\`\`

---

## Full PRD Example

Here is a real example of a Tier 3 (Full) PRD for reference. This is what a user request like "Build an n8n workflow that processes new leads from our Typeform" would produce:

\`\`\`
---
schemaversion: 1
slug: workflow-typeform-lead-qualification
title: "Typeform Lead Qualification and Routing"
section: Automations
category: "Sales"
tags:
  - n8n
  - workflow
  - automation
  - typeform
  - linear
  - mailchimp
  - slack
order: 5
locked: false
author: sulla
created_at: 2026-02-23T23:00:00Z
updated_at: 2026-02-23T23:00:00Z
mentions:
  - n8n-workflow
  - lead-generation
related_entities:
  - AI Agent
  - Sales
---

# Skill: Automation Workflow (n8n) Project

**Ultimate Project Goal**: Automatically qualify every new Typeform lead submission, create a Linear ticket for high-quality leads, add them to the correct Mailchimp audience, and notify the responsible sales rep in Slack with a personalized message.

**Owner**: Jonathon Byrdziak
**Start Date**: 2026-02-23

**User Stories**
- As a sales rep, I want qualified leads automatically created in Linear so I don't miss hot prospects.
- As a marketing manager, I want new leads added to the right Mailchimp list for nurturing.
- As a sales lead, I want to be notified instantly in Slack when a good lead comes in with all key details.

**Checklist of Completed Items**
None documented in current context or memory.

**Must Haves**
- Typeform webhook trigger on new submission
- Qualification logic based on company size and budget
- Create Linear ticket for qualified leads
- Add lead to correct Mailchimp audience
- Send personalized Slack message to the assigned sales rep
- Full logging of every decision

**Should Haves**
- Score lead on a 1-10 scale
- Different Mailchimp lists based on lead quality
- Attach form responses to Linear ticket

**Nice-to-Haves**
- AI-generated personalized first message to the lead
- Auto-assign sales rep based on region
- Daily lead digest summary

**What Has Been Tried and Didn't Work**
None documented in current context or memory.

## Requirements
- **Trigger type**: Typeform webhook (new submission)
- **Error handling**: If any integration fails, log the full error, send alert to #sales-alerts Slack channel, and do not create partial records. Retry up to 3 times.

## Template Research
- Categories explored: Typeform, Lead Qualification, Linear, Mailchimp, Slack
- Search queries used: "typeform lead qualification linear mailchimp n8n", "typeform to linear ticket n8n"
- Top candidates:
  - Template ID 14567: "Typeform to Linear Ticket" (fit 8/10 — good ticket creation but no Mailchimp)
  - Template ID 13289: "Typeform Lead Router" (fit 9/10 — excellent qualification and routing logic)
- Selected template: Template ID 13289 ("Typeform Lead Router")
- Rationale: This template already handles Typeform webhook, scoring logic, and routing. We only need to add Mailchimp subscription and Slack notification nodes.

## Credential Resolution
| Integration   | Required | Status     | Notes / Action Needed                  |
|---------------|----------|------------|----------------------------------------|
| Typeform      | Yes      | Ready      | Webhook already configured             |
| Linear        | Yes      | Ready      | API key ready                          |
| Mailchimp     | Yes      | Ready      | API key ready                          |
| Slack         | Yes      | Ready      | Bot token ready                        |

## Workflow Details
- **Workflow name**: workflow-typeform-lead-qualification
- **High-level node flow**: Typeform Webhook → Qualify Lead → Conditional Router → Create Linear Ticket → Subscribe to Mailchimp → Send Slack Notification
- **Nodes**: 8 | **Connections**: 10 (based on selected template + 2 added nodes)

## Execution Checklist
- [ ] Health check passed
- [ ] Project article created
- [ ] Requirements documented
- [ ] Template research completed
- [ ] Credentials resolved
- [ ] Template imported and modified
- [ ] Workflow created and nodes configured
- [ ] Workflow activated
- [ ] Full test run completed successfully
- [ ] Project article fully updated
- [ ] Delivery confirmed
\`\`\`

---

## README.md Conventions
The README.md is auto-scaffolded when creating a project. It should contain:
- Project title and description (pulled from PROJECT.md)
- Getting Started section
- Project Structure section
- Development section

## Best Practices
1. **Always search first** — avoid duplicate projects
2. **Use kebab-case slugs** — e.g., \`daily-intelligence-monitor\`
3. **Match PRD size to task complexity** — don't over-document a bug fix, don't under-document a multi-system integration
4. **Keep PROJECT.md as the single source of truth** — all project details live here
5. **Use patch_project for incremental updates** — faster and less error-prone than full rewrites
6. **Set status accurately** — active, paused, completed, or archived
7. **Include workspace_path** — so tools can locate the project folder
8. **Tag consistently** — always include "project" plus relevant domain tags
`;
  },
};

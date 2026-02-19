export const sopN8nWorkflowCreation = `---
schemaversion: 1
slug: sop-n8n-workflow-creation
title: "SOP: Create n8n Automation Workflow"
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

# SOP: AI Automation Workflow Creation (n8n)

**Trigger**: Human says "build workflow", "create automation for X", "set up n8n to do Y".

**Project article slug** = workflow-{purpose-kebab}

This SOP produces a long-running project article in memory that tracks every phase of the build. The article is the single source of truth. Before starting any step, use "article_find" slug:workflow-{slug} to reload the latest state. After completing any step, use "article_update" to persist progress. If a session is interrupted, the article contains everything needed to resume.

\`\`\`
# Workflow: {purpose}

## Plan
- [x] Health check
- [ ] Intake & requirements
- [ ] Template research
- [ ] Credential resolution
- [ ] Workflow creation
- [ ] Node configuration & credential assignment
- [ ] Activation
- [ ] Testing
- [ ] Final documentation
- [ ] Delivery

## Requirements
- **Purpose**: {what the workflow does}
- **Trigger type**: {webhook, schedule, manual, event}
- **Data sources**: {list}
- **Integrations needed**: {list of integration slugs}
- **Success criteria**: {how to know it works}
- **Error handling**: {what to do on failure}

## Template Research
- **Categories explored**: {list}
- **Search queries used**: {list}
- **Top candidates**: {templateId: name, score, reason}
- **Selected template**: {templateId or "none - building from scratch"}
- **Template details**: {nodes, connections summary if selected}

## Credentials
| Integration | Slug | Connected | n8n Credential ID | Credential Type | Status |
|---|---|---|---|---|---|
| {name} | {slug} | yes/no | {id or "pending"} | {type} | ready/missing/created |

## Workflow
- **Workflow ID**: {id or "pending"}
- **Workflow name**: {slug}
- **Based on template**: {templateId or "scratch"}
- **Node list**: {ordered list of node names and types}
- **Connection map**: {summary of node-to-node connections}

## Activation
- **Status**: pending / active / failed
- **Activated at**: {timestamp or "n/a"}
- **Failure reason**: {if failed}

## Testing
- **Test runs**: {count}
- **Last result**: pass/fail
- **Errors encountered**: {list or "none"}
- **Resolution**: {what was fixed}

## Notes
{Any additional context, decisions, or blockers}
\`\`\`

---

## Steps

### 1. Health Check

- Use tool "health_check" to confirm n8n is running and reachable.
- If unhealthy, stop and report the issue. Do not proceed.

### 2. Intake & Project Article Creation

- Clarify requirements with the human: trigger type, data sources, integrations needed, success criteria, error handling.
- Use tool "article_find" slug:workflow-{slug} to check if a project article already exists (resuming a previous session).
  - **If found**: use "article_find" to load the full article. Read the Plan section to determine which step to resume from. Skip to that step.
  - **If not found**: create a new project article:
- Use tool "article_create" with:
  - slug: workflow-{slug}
  - title: "Workflow: {purpose}"
  - section: Workflows
  - category: Automation
  - related_slugs: sop-n8n-workflow-creation
  - tags: n8n,workflow,automation,{purpose-kebab}
  - content: the full Project Article Schema above, populated with requirements from intake. Mark "Health check" and "Intake & requirements" as [x] in the Plan.
- Call "add_observational_memory" priority:🟡 "New workflow project created: workflow-{slug} for {purpose}"

### 3. Template Research

- Use tool "article_find" slug:workflow-{slug} to reload current state.
- Use tool "get_template_categories" to list available categories.
- Use tool "search_templates" with search:{full use case description}. Also try filtering by category and nodes.
- Evaluate top 3 results for fit against the requirements in the article.
- If a strong match exists, use tool "get_template_workflow" id:{templateId} to retrieve full template details (nodes, connections, settings).
- If search yields poor results, use tool "get_template_collections" to browse curated collections.
- **Update article**: use tool "article_update" slug:workflow-{slug} content:{updated content} to record:
  - Template Research section: categories explored, search queries, top candidates with scores, selected template, template details.
  - Plan: mark "Template research" as [x].

### 4. Credential Resolution

- Use tool "article_find" slug:workflow-{slug} to reload current state.
- From the template details or planned node list, identify every integration the workflow requires.
- For each integration:
  - Use tool "integration_get_credentials" integration_slug:{slug} to retrieve stored credentials and connection status.
  - If credentials are missing or the integration is not connected, record the blocker in the article and instruct the human to configure it before proceeding.
- Use tool "get_credentials" to list existing n8n credential entities. Match them to the required node credential types.
- For any required credential that does not exist in n8n, use tool "create_credential" to create it using values from "integration_get_credentials".
- **Update article**: use tool "article_update" slug:workflow-{slug} content:{updated content} to record:
  - Credentials table: fill in every row with integration name, slug, connected status, n8n credential ID, credential type, and status (ready/missing/created).
  - Plan: mark "Credential resolution" as [x].
  - If any credentials are blocked, add a note in the Notes section and stop.

### 5. Create Workflow

- Use tool "article_find" slug:workflow-{slug} to reload current state.
- If a template was selected in step 3: use the template's nodes, connections, and settings as the base payload.
- Otherwise: build the nodes array, connections object, and settings from scratch based on the Requirements section of the article.
- Use tool "create_workflow" with name:workflow-{slug}, nodes, connections, settings.
- Record the returned workflow ID.
- **Update article**: use tool "article_update" slug:workflow-{slug} content:{updated content} to record:
  - Workflow section: workflow ID, name, based-on-template, initial node list, connection map.
  - Plan: mark "Workflow creation" as [x].

### 6. Configure Nodes & Assign Credentials

- Use tool "article_find" slug:workflow-{slug} to reload current state. Read the Credentials table and Workflow section.
- For each node in the workflow, assign the correct n8n credential ID from the Credentials table.
- For code nodes: write the JS/TS logic inline or reference workspace files as needed.
- Use tool "update_workflow" id:{workflowId} to push the fully configured nodes, connections, and settings.
- Use tool "get_workflow" id:{workflowId} to verify the saved state matches expectations.
- **Update article**: use tool "article_update" slug:workflow-{slug} content:{updated content} to record:
  - Workflow section: updated node list with credential assignments noted.
  - Plan: mark "Node configuration & credential assignment" as [x].

### 7. Activate

- Use tool "article_find" slug:workflow-{slug} to reload current state.
- Use tool "activate_workflow" id:{workflowId}.
- Use tool "get_workflow" id:{workflowId} and confirm the workflow's active field is true.
- If activation fails: inspect the error, fix the configuration via "update_workflow", and retry.
- **Update article**: use tool "article_update" slug:workflow-{slug} content:{updated content} to record:
  - Activation section: status (active or failed), timestamp, failure reason if applicable.
  - Plan: mark "Activation" as [x] if successful.

### 8. Test & Monitor

- Use tool "article_find" slug:workflow-{slug} to reload current state.
- Trigger a test execution (manual or via the workflow's trigger).
- Use tool "get_workflows" active:true to confirm the workflow appears in the active list.
- Review execution output for errors.
- If errors: use "deactivate_workflow" id:{workflowId}, fix via "update_workflow", re-activate via "activate_workflow", and re-test.
- **Update article**: use tool "article_update" slug:workflow-{slug} content:{updated content} to record:
  - Testing section: test run count, last result, errors encountered, resolution applied.
  - Plan: mark "Testing" as [x] when a clean pass is achieved.

### 9. Final Documentation

- Use tool "article_find" slug:workflow-{slug} to reload current state.
- Ensure every section of the article is fully populated: requirements, template research, credentials table, workflow details, activation status, test results.
- Add any reusable patterns or lessons learned to the Notes section.
- **Update article**: use tool "article_update" slug:workflow-{slug} content:{updated content} to record:
  - Plan: mark "Final documentation" as [x].
  - Ensure the article is a complete, self-contained reference for this workflow.

### 10. Delivery

- Use tool "article_find" slug:workflow-{slug} to reload current state.
- Report to human: workflow ID, activation status, test results, link to project article slug.
- Call "add_observational_memory" priority:🟡 "Workflow workflow-{slug} live and monitored. Project article: workflow-{slug}"
- **Update article**: use tool "article_update" slug:workflow-{slug} content:{updated content} to record:
  - Plan: mark "Delivery" as [x]. All items should now be checked.

---

## Resuming an Interrupted Build

If this SOP is invoked and "article_find" slug:workflow-{slug} returns an existing article:

1. Read the Plan section. Find the first unchecked item.
2. Read all other sections to restore context (requirements, template research, credentials, workflow ID, etc.).
3. Resume from the first unchecked step. Do not repeat completed steps.
4. Continue updating the article at each step as described above.

---

## Rules

- Always run "health_check" first.
- Always create or load the project article before doing any work.
- Always update the project article after completing each step.
- Always reload the project article via "article_find" before starting each step.
- Always search templates before building from scratch.
- Always resolve credentials before creating the workflow.
- Never activate a workflow without verifying credential assignments.
- If any step fails, update the article with the failure details and stop. Do not proceed with incomplete state.
- The project article is the single source of truth. All decisions, IDs, and state live there.
`;
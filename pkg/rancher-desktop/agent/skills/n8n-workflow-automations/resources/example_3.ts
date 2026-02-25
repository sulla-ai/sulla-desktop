export const example_3 = `
As a planner for automations you will turn user requests into project requirements documents.
**User request (this is what the human would actually say):**

    "Create a daily team performance report in n8n. Every morning at 7:30 AM it should pull data from our main Google Sheet, calculate key metrics for each team member, and send a formatted summary to our #team-performance Slack channel plus an email to the managers."

**Your response (this is what you would actually respond with):**
<FINAL_PRD>
---
schemaversion: 1
slug: workflow-daily-team-performance-report
title: "Daily Team Performance Report from Google Sheets"
section: Automations
category: "Reporting"
tags:
  - n8n
  - workflow
  - automation
  - reporting
  - google-sheets
  - slack
order: 5
locked: false
author: sulla
created_at: 2026-02-23T22:45:00Z
updated_at: 2026-02-23T22:45:00Z
mentions:
  - n8n-workflow
  - team-performance
related_entities:
  - AI Agent
  - Operations
---

# Skill: Automation Workflow (n8n) Project

**Ultimate Project Goal**: Automatically generate and deliver a daily team performance report every morning at 7:30 AM by pulling data from our master Google Sheet, calculating individual and team metrics, and sending a clean summary to Slack and email for the managers.

**Owner**: Jonathon Byrdziak  
**Start Date**: 2026-02-23

**User Stories**
- As a manager, I want a daily performance summary delivered automatically so I don’t have to open the spreadsheet every morning.
- As a team lead, I want to see individual metrics and team totals in one message so I can spot issues quickly.
- As an operations person, I want the report to be consistent and archived for historical tracking.

**Checklist of Completed Items**
None documented in current context or memory.

**Must Haves**
- Daily scheduled trigger at 7:30 AM
- Pull latest data from master Google Sheet
- Calculate key metrics per person and team totals
- Send formatted report to #team-performance Slack channel
- Send same report via email to managers
- Include error handling and fallback notification

**Should Haves**
- Highlight top and bottom performers
- Simple visual indicators (arrows for trending up/down)
- Attach CSV export of raw data

**Nice-to-Haves**
- AI-generated one-sentence insight summary
- Dark/light mode support in Slack message
- Historical comparison vs previous day

**What Has Been Tried and Didn't Work**
None documented in current context or memory.

## Requirements
- **Trigger type**: Schedule (daily at 07:30)
- **Error handling**: If Google Sheets fails to load, send detailed alert to #ops-alerts Slack channel, log full error, and do not send partial report. Retry up to 3 times.

## Credential Resolution
| Integration    | Required | Status     | Notes / Action Needed                  |
|----------------|----------|------------|----------------------------------------|
| Google Sheets  | Yes      | Ready      | Service account ready                  |
| Slack          | Yes      | Ready      | Bot token with chat:write scope        |
| Gmail          | Yes      | Ready      | OAuth2 ready for manager emails        |

## Workflow Details
- **Workflow name**: workflow-daily-team-performance-report
- **High-level node flow**: Schedule Trigger → Read Google Sheet → Calculate Metrics → Format Report → Post to Slack → Send Email

## Execution Steps (Incremental Build Plan for ReAct loop)

The Technical Execution Briefs MUST build this workflow in small, verifiable increments. 
The number of steps will vary (3–25) depending on workflow complexity — always choose the smallest logical chunks that can be fully built and tested in one cycle.
Check off each step as it is completed:

- [ ] 1. Create the empty workflow \`workflow-daily-team-performance-report\` with basic settings.
- [ ] 2. Add Schedule Trigger node (daily at 07:30 America/Los_Angeles) + verify with manual trigger.
- [ ] 3. Add Google Sheets node to read master performance data + normalize output.
- [ ] 4. Add Code node to calculate all key metrics and highlight top/bottom performers.
- [ ] 5. Add formatting + Slack Post Message + Gmail Send Email nodes with CSV attachment.
- [ ] 6. Add Error Trigger / Catch nodes + fallback alert, then validate, activate, and run one manual test.

**Note**: The exact number of steps will always match what is needed to keep each increment small and testable. All steps above can be completed immediately since credentials are Ready.

Each step must be completed, verified with \`get_workflow\` / \`get_workflow_node_list\`, and confirmed working before the next step begins.
</FINAL_PRD>
`;
// Example PRD template — used by MacroNode on first cycle only
// to show the LLM the expected format and depth.
// This is NOT a real PRD — it's a reference example.

export const EXAMPLE_PRD = `
---
schemaversion: 1
slug: workflow-example-daily-sales-summary
title: "Daily Sales Summary Report Generator"
section: Automations
category: "Reporting"
tags:
  - n8n
  - workflow
  - automation
  - reporting
  - email
order: 5
locked: false
author: sulla
created_at: 2026-02-23T22:00:00Z
updated_at: 2026-02-23T22:00:00Z
mentions:
  - n8n-workflow
  - sales-data
related_entities:
  - AI Agent
  - Business Intelligence
---

# Skill: Automation Workflow (n8n) Project

**Ultimate Project Goal**: Automatically generate and send a daily sales summary report every morning at 8:00 AM to the sales team with key metrics, top performers, and alerts for any concerning trends.

**Owner**: Jonathon Byrdziak  
**Start Date**: 2026-02-23

**User Stories**
- As a sales manager, I want a concise daily summary email so I can quickly see performance without logging into multiple tools.
- As a team lead, I want alerts for underperforming reps or missing data so I can take action the same day.
- As an executive, I want the report to include trend analysis and exportable CSV attachment.

**Checklist of Completed Items**
None documented in current context or memory.

**Must Haves**
- Daily scheduled trigger at 8:00 AM
- Pull sales data from source system(s)
- Calculate key metrics (total revenue, orders, top products, growth %)
- Generate formatted email with charts/summary
- Send to defined recipients
- Include error handling and fallback notification

**Should Haves**
- CSV export attached to email
- Simple trend analysis (vs yesterday / vs last week)
- Highlight any missing data or anomalies

**Nice-to-Haves**
- AI-generated executive summary paragraph
- Dark mode / branded email template
- Option to send via Slack as well

**What Has Been Tried and Didn't Work**
None documented in current context or memory.

## Requirements
- **Trigger type**: Schedule (daily at 08:00)
- **Error handling**: If any data source fails, send detailed alert email to admin, log full error, and do not send partial report. Retry up to 3 times.

## Credential Resolution
**What credentials will be required, which we have and which ones we need from the project owner:**

| Integration   | Required? | Status     | Notes / Action Needed                     |
|---------------|-----------|------------|-------------------------------------------|
| Stripe        | Yes       | Ready      | API key already stored                    |
| Google Sheets | Yes       | Ready      | Service account ready                     |
| Gmail         | Yes       | Ready      | OAuth2 ready                              |
| Slack         | Optional  | Not needed | Only if nice-to-have is approved          |

## Workflow Details
- **Workflow name**: workflow-daily-sales-summary
- **High-level node flow**: Schedule Trigger → Fetch Stripe Data → Fetch Google Sheets Data → Calculate Metrics → Generate Report → Send Email

## Blockers
- The things preventing this workflow from running succesfully

### High-Level Node Flow

\`\`\`
Schedule Trigger (6AM PT)
    │
    ├──► [Parallel Branch 1] HTTP Request → X API v2 Search (AI keywords)
    │         └── IF: X API success? → Parse Tweets → Extract metrics + text
    │                              ↘ Log X API failure → Set Error Flag
    │
    ├──► [Parallel Branch 2] RSS Read → HackerNews AI feed
    │         └── Parse + normalize items
    │
    ├──► [Parallel Branch 3] RSS Read → Dev.to #ai feed
    │         └── Parse + normalize items
    │
    ├──► [Parallel Branch 4] HTTP Request → GitHub Trending API
    │         └── Parse repos → extract name, stars, description
    │
    └──► Merge All Branches (n8n Merge node — all inputs)
              │
              ▼
         Deduplicate by URL/title (Code node — JS)
              │
              ▼
         AI Filter + Rank (HTTP Request → Sulla endpoint)
         Prompt: score 1-10 relevance, extract topic, summary, YouTube angle, category tag
              │
              ▼
         Sort + Select Top 15 (Code node)
              │
              ▼
         [Split outputs]
              │
              ├──► Format Full Report (Set node → JSON structure)
              │         └──► Write to Long-Term Memory (HTTP Request → memory API)
              │                   slug: youtube-topic-report-{{ $now.format('YYYY-MM-DD') }}
              │
              └──► Format Slack Digest (top 5 topics, category tags, one-liners)
                        └──► Slack Post Message (existing Slack credential)
                                    └──► [On any upstream error] → Slack Alert to #automation-alerts
\`\`\`

### Key Node Definitions

| # | Node Name | Type | Purpose |
|---|---|---|---|
| 1 | \`Schedule Trigger\` | Schedule | Fires daily at 06:00 PT |
| 2 | \`Search X API\` | HTTP Request | X API v2 recent search, Bearer Token auth |
| 3 | \`X API Error Check\` | IF | Status 200 → proceed, else → log |
| 4 | \`Parse X Results\` | Code (JS) | Extract text, URL, metrics, author |
| 5 | \`RSS HackerNews\` | RSS Feed Read | Pull HackerNews AI tag feed |
| 6 | \`RSS Dev.to\` | RSS Feed Read | Pull Dev.to #ai feed |
| 7 | \`GitHub Trending\` | HTTP Request | Pull GitHub trending AI repos |
| 8 | \`Normalize Items\` | Set | Standardize schema across all sources |
| 9 | \`Merge All Sources\` | Merge | Collect all branches |
| 10 | \`Deduplicate\` | Code (JS) | Remove URL/title duplicates |
| 11 | \`AI Filter + Rank\` | HTTP Request | POST to Sulla endpoint — score + summarize |
| 12 | \`Sort Top 15\` | Code (JS) | Sort by AI score descending, take top 15 |
| 13 | \`Format Full Report\` | Set | Build structured JSON report |
| 14 | \`Write to Memory\` | HTTP Request | Store dated report in long-term memory |
| 15 | \`Format Slack Digest\` | Set | Build top-5 Slack message blocks |
| 16 | \`Post to Slack\` | Slack | Post digest to designated channel |
| 17 | \`Error Accumulator\` | Set | Collect any source errors |
| 18 | \`Slack Error Alert\` | Slack | Alert to #automation-alerts on total failure |

## Execution Steps (Incremental Build Plan for ReAct loop)

The Technical Execution Briefs MUST build this workflow in small, verifiable increments. 
The following steps represent a single TEB and ReAct loop.
Check off each step as it is completed:

- [ ] 1. Create the empty workflow \`workflow-daily-sales-summary\` with basic settings (name, timezone, saveDataErrorExecution: all, saveDataSuccessExecution: all).
- [ ] 2. Add Schedule Trigger node (daily at 08:00 America/Los_Angeles) + verify with manual trigger.
- [ ] 3. Add Stripe node (or HTTP Request) to fetch today's sales data + Set node to normalize output.
- [ ] 4. Add Google Sheets node to pull additional sales data + Merge node to combine both sources.
- [ ] 5. Add Code node to calculate key metrics (revenue, orders, top products, growth %) + Set node for summary data.
- [ ] 6. Add HTML node (or Set + Function) to generate formatted email body with tables/charts.
- [ ] 7. Add Gmail Send Email node (to defined recipients) + attach CSV export of raw data.
- [ ] 8. Wrap all data-fetch nodes in Try/Catch (Error Trigger + IF) + fallback alert email to admin on failure.
- [ ] 9. Validate full payload with validate_workflow_payload, activate workflow, and run one manual test.
- [ ] 10. (Later cycles) Add trend analysis, AI executive summary, Slack notification, or weekly roll-up.

Each step must be completed, verified with \`get_workflow\` / \`get_workflow_node_list\`, and confirmed working before the next step begins.
`;

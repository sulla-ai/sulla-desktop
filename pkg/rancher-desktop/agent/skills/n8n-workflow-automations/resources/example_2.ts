export const example_2 = `
As a planner for automations you will turn user requests into project requirements documents.
**User request (this is what the human would actually say):**

    "Create an n8n workflow that automatically sends payment reminders for overdue Stripe invoices. 
    Send reminders at 7, 14, and 21 days past due, update our master Google Sheet with the current payment status, and log everything for accounting audit. 
    Make it reliable with good error handling."

**Your response (this is what you would actually respond with):**

<FINAL_PRD>
---
schemaversion: 1
slug: workflow-stripe-invoice-reminder
title: "Stripe Invoice Processing and Automated Payment Reminders"
section: Automations
category: "Finance"
tags:
  - n8n
  - workflow
  - automation
  - stripe
  - invoicing
  - reminders
order: 5
locked: false
author: sulla
created_at: 2026-02-23T22:30:00Z
updated_at: 2026-02-23T22:30:00Z
mentions:
  - n8n-workflow
  - stripe
  - accounting
related_entities:
  - AI Agent
  - Finance
---

# Skill: Automation Workflow (n8n) Project

**Ultimate Project Goal**: Automatically detect new Stripe invoices, send polite payment reminders at 7, 14, and 21 days past due, update payment status in our master Google Sheet, and log everything for accounting audit.

**Owner**: Jonathon Byrdziak  
**Start Date**: 2026-02-23

**User Stories**
- As the finance team, I want new invoices automatically tracked so nothing falls through the cracks.
- As a customer, I want gentle reminders so I can pay without being chased manually.
- As the accountant, I want payment status automatically updated in the master spreadsheet.

**Checklist of Completed Items**
None documented in current context or memory.

**Must Haves**
- Stripe trigger on new invoice created or payment status changed
- Send reminder emails at 7, 14, and 21 days past due
- Update Google Sheet with current payment status
- Log every action for audit
- Robust error handling and fallback notifications

**Should Haves**
- Different reminder tone based on days overdue
- Attach original invoice PDF to reminders
- Daily summary report of outstanding invoices

**Nice-to-Haves**
- AI-generated personalized reminder text
- Auto-archive paid invoices
- Slack notification for high-value overdue invoices

**What Has Been Tried and Didn't Work**
None documented in current context or memory.

## Requirements
- **Trigger type**: Stripe "invoice.created" and "invoice.payment_failed" webhooks
- **Error handling**: If Stripe or Google Sheets fails, retry up to 3 times, then send alert to #finance-alerts Slack channel and pause the workflow until manually resumed.

## Credential Resolution
| Integration   | Required | Status     | Notes / Action Needed                  |
|---------------|----------|------------|----------------------------------------|
| Stripe        | Yes      | Ready      | Webhook + API key already configured   |
| Gmail         | Yes      | Ready      | OAuth2 ready for sending reminders     |
| Google Sheets | Yes      | Ready      | Service account ready                  |

## Workflow Details
- **Workflow name**: workflow-stripe-invoice-reminder
- **High-level node flow**: Stripe Webhook → Check Invoice Status → Conditional Delay (7/14/21 days) → Send Reminder Email → Update Google Sheet → Log Action

## Execution Steps (Incremental Build Plan for ReAct loop)

The Technical Execution Briefs MUST build this workflow in small, verifiable increments. 
The following steps represent a single TEB and ReAct loop.
Check off each step as it is completed:

- [ ] 1. Create the empty workflow \`workflow-stripe-invoice-reminder\` with basic settings (name, active schedule off, error/success data settings).
- [ ] 2. Add Stripe Webhook trigger (invoice.created + invoice.payment_failed) + verify webhook fires.
- [ ] 3. Add Set/Code node to calculate days overdue and determine reminder tier (7/14/21).
- [ ] 4. Add IF nodes for the three reminder branches + Delay nodes (7 days, 14 days, 21 days).
- [ ] 5. Add Gmail Send Email node for reminders (with conditional tone based on tier) + attach invoice PDF.
- [ ] 6. Add Google Sheets node to update master sheet with current payment status.
- [ ] 7. Add full audit logging (Set node → Data Table or long-term memory write).
- [ ] 8. Add Error Trigger / Catch nodes + fallback alert to #finance-alerts (email + Slack stub).
- [ ] 9. Validate full payload with \`validate_workflow_payload\`, save workflow, activate it, and run one manual test with a test invoice.
- [ ] 10. Add AI personalized text, daily summary report, auto-archive, or Slack high-value alerts.

**Note**: All steps 1–9 can be completed and fully tested immediately (all credentials are Ready). The workflow will be production-ready after step 9 with core reminders and logging active.

Each step must be completed, verified with \`get_workflow\` / \`get_workflow_node_list\`, and confirmed working before the next step begins.
</FINAL_PRD>
`;
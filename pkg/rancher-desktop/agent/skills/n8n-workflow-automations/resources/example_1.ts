export const example_1 = `
As a planner for automations you will turn user requests into project requirements documents.
**User request (this is what the human would actually say):**

    "Build a workflow in n8n that automatically triages our support emails. 

    When a new email comes into support@sulladesktop.com, use AI to classify it by urgency (high/medium/low) and category (billing, technical, general, etc.), then route it to the correct Slack channel with the full email context. Also send an instant AI-generated polite acknowledgment reply to the customer and log the whole decision for audit purposes.

    We want it to be reliable with good error handling."

**Your response (this is what your would actually respond with):**


<FINAL_PRD>
---
schemaversion: 1
slug: workflow-support-email-auto-triage
title: "Auto-Triage Support Emails with AI Classification and Slack Routing"
section: Automations
category: "Customer Support"
tags:
  - n8n
  - workflow
  - automation
  - ai
  - triage
  - slack
  - email
order: 5
locked: false
author: sulla
created_at: 2026-02-23T22:15:00Z
updated_at: 2026-02-23T22:15:00Z
mentions:
  - n8n-workflow
  - support-inbox
related_entities:
  - AI Agent
  - Customer Support
---

# Skill: Automation Workflow (n8n) Project

**Ultimate Project Goal**: Automatically triage every new support email sent to support@sulladesktop.com by classifying urgency and category with AI, route it to the correct Slack channel with full context, send an instant polite AI-generated acknowledgment reply, and log the entire decision for audit purposes.

**Owner**: Jonathon Byrdziak  
**Start Date**: 2026-02-23

**User Stories**
- As a support agent, I want new emails automatically routed to the right Slack channel with priority tags so I can respond faster.
- As a customer, I want an immediate acknowledgment reply so I know my request was received and is being handled.
- As a team lead, I want every triage decision logged with reason, urgency, and category so we can audit response times and improve classification.

**Checklist of Completed Items**
None documented in current context or memory.

**Must Haves**
- Gmail trigger on new emails to support@sulladesktop.com
- AI classification for urgency (high/medium/low) and category (billing, technical, general, etc.)
- Route full email context (subject, body, attachments summary) to the correct Slack channel
- Send instant AI-generated polite acknowledgment reply
- Full audit logging of classification, routing decision, and reply
- Robust error handling with fallback to manual notification

**Should Haves**
- Linear ticket creation for high-priority items
- Attachment forwarding to the assigned Slack channel
- Weekly triage performance summary report

**Nice-to-Haves**
- Customer sentiment analysis added to classification
- Auto-escalation if no reply from agent within 4 hours
- Suggested knowledge-base article in the reply

**What Has Been Tried and Didn't Work**
None documented in current context or memory.

## Requirements
- **Trigger type**: Gmail new email trigger (support@sulladesktop.com)
- **Error handling**: If any API call fails, retry up to 3 times, then send detailed alert to #support-unrouted Slack channel and log full error details. Never send partial or incorrect replies.

## Credential Resolution
| Integration   | Required | Status     | Notes / Action Needed                          |
|---------------|----------|------------|------------------------------------------------|
| Gmail         | Yes      | ✅ Ready   | OAuth2 connected                               |
| Grok / OpenAI | Yes      | ✅ Ready   | Local endpoint ready (no credential needed)    |
| Slack         | Yes      | ❌ Missing | **Blocker** — Bot token with chat:write scope required |

## Blockers
**Critical blocker preventing full activation:**
- Slack credential is missing. The workflow cannot post messages or route to Slack channels until a valid Slack Bot token is provided.

**Action required from Jonathon:**
Provide a Slack Bot token with \`chat:write\` and \`chat:write.public\` scopes (or confirm the existing "Byrdziak's Assistant" bot can be used). Once provided, the credential will be created with \`create_credential\` and the workflow can be activated.

## Workflow Details
- **Workflow name**: workflow-support-email-auto-triage
- **High-level node flow**: Gmail Trigger → AI Classify → Conditional Router → Slack Post Message → AI Reply Generator → Gmail Send Reply

## Execution Steps (Incremental Build Plan for ReAct loop)

The Technical Execution Briefs MUST build this workflow in small, verifiable increments. 
The following steps represent a single TEB and ReAct loop.
Check off each step as it is completed:

- [ ] 1. Create the empty workflow \`workflow-support-email-auto-triage\` with basic settings (name, active schedule off, error/success data settings).
- [ ] 2. Add Gmail Trigger node (new email to support@sulladesktop.com) + verify trigger fires.
- [ ] 3. Add AI Classification node (HTTP Request to local endpoint) + Set node to extract urgency + category.
- [ ] 4. Add IF nodes for routing (3 branches: high, medium, low).
- [ ] 5. Add AI Reply Generator node + Gmail Send Reply node on the success path.
- [ ] 6. Add Error Trigger / Catch nodes + fallback alert (email only — Slack blocked).
- [ ] 7. Add full audit logging (Set → Data Table or memory write).
- [ ] 8. Add disabled Slack stub nodes (Set node labeled "[BLOCKED: Awaiting Slack credential]") on each routing branch + wire to fallback email alert.
- [ ] 9. Validate full payload, activate workflow, and run one manual test email (everything works with email fallback).
- [ ] 10. **Final step (after Jonathon provides Slack credential)**: Create real Slack credential → replace stub nodes with live Slack Post Message nodes → remove fallback → re-activate.

**Note**: Steps 1–9 can be completed and fully tested **immediately**. The Slack blocker is isolated to step 10 only. The workflow is production-ready with email fallback until the credential is supplied.

Each step must be completed, verified with \`get_workflow\` / \`get_workflow_node_list\`, and confirmed working before the next step begins.
</FINAL_PRD>
`;
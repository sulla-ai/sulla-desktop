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
| Integration   | Required | Status     | Notes / Action Needed                  |
|---------------|----------|------------|----------------------------------------|
| Gmail         | Yes      | Ready      | OAuth2 connected                       |
| Grok / OpenAI | Yes      | Ready      | API key ready                          |
| Slack         | Yes      | Ready      | Bot token with chat:write scope        |

## Workflow Details
- **Workflow name**: workflow-support-email-auto-triage
- **High-level node flow**: Gmail Trigger → AI Classify → Conditional Router → Slack Post Message → AI Reply Generator → Gmail Send Reply
- **Nodes**: 6 | **Connections**: 8
</FINAL_PRD>
`;
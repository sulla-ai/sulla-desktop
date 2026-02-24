export const example_4 = `
As a planner for automations you will turn user requests into project requirements documents.
**User request (this is what the human would actually say):**

    "Build an n8n workflow that processes new leads from our Typeform. 
    When someone submits the form, qualify them based on company size and budget, create a Linear ticket if they look good, add them to our Mailchimp list, and send a personalized Slack message to the sales rep who owns that region."

**Your response (this is what you would actually respond with):**
<FINAL_PRD>
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
- As a sales rep, I want qualified leads automatically created in Linear so I don’t miss hot prospects.
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
</FINAL_PRD>
`;
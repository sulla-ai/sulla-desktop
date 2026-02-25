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
title: "Typeform Lead Qualification and Multi-Channel Routing"
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
  - follow-up
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

**Ultimate Project Goal**: Automatically qualify every new Typeform lead submission, create a Linear ticket for high-quality leads, add them to the correct Mailchimp audience, notify the responsible sales rep in Slack, and trigger a multi-channel follow-up sequence (email, SMS, chat, and phone call task) for nurturing.

**Owner**: Jonathon Byrdziak  
**Start Date**: 2026-02-23

**User Stories**
- As a sales rep, I want qualified leads automatically created in Linear so I don’t miss hot prospects.
- As a marketing manager, I want new leads added to the right Mailchimp list for nurturing.
- As a sales lead, I want to be notified instantly in Slack when a good lead comes in with all key details.
- As the sales team, I want automated follow-ups across email, SMS, chat, and phone call tasks so no lead goes cold.

**Checklist of Completed Items**
None documented in current context or memory.

**Must Haves**
- Typeform webhook trigger on new submission
- AI + rule-based qualification (company size + budget)
- Create Linear ticket for qualified leads
- Add lead to correct Mailchimp audience
- Send personalized Slack message to assigned sales rep
- Multi-channel follow-up sequence: email (Day 1), SMS (Day 3), chat message (Day 5), phone call task (Day 7)
- Full logging of every decision and follow-up

**Should Haves**
- Lead score 1-10 with clear reasoning
- Different Mailchimp segments based on quality
- Attach full form responses to Linear ticket

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
| Twilio (SMS)  | Yes      | Ready      | Account SID + Auth Token ready         |
| Gmail         | Yes      | Ready      | OAuth2 ready                           |

## Workflow Details
- **Workflow name**: workflow-typeform-lead-qualification
- **Nodes**: 24 | **Connections**: 32
- **High-level node flow** (comprehensive multi-branch structure):

\`\`\`
Typeform Webhook Trigger
    │
    ├──► Qualify Lead (AI Scoring + Rules)
    │         System: Score 1-10 on company size, budget, role
    │         Output: {score, qualified: true/false, region, owner}
    │
    └──► IF Qualified (score >= 7 OR budget >= $50k)
              │
              ├──► Create Linear Ticket (full form data + attachments)
              ├──► Subscribe to Mailchimp (correct audience/segment)
              ├──► Send Immediate Personalized Slack (to region owner)
              │
              └──► Schedule Follow-up Sequence (Parallel branches)
                        │
                        ├──► Delay 1 Day → Gmail Send Personalized Email Follow-up
                        ├──► Delay 3 Days → Twilio Send SMS Follow-up
                        ├──► Delay 5 Days → Intercom/Chat Send Message
                        └──► Delay 7 Days → Create Phone Call Task in Linear (with reminder)
    │
    ▼
Merge All Paths (Merge node)
    │
    ▼
Full Audit Logging (Set → Data Table + Long-term Memory)
    │
    ▼
Error Handling Branch (Error Trigger + IF)
    IF any failure → Slack Critical Alert to #sales-alerts + Log
\`\`\`

## Execution Steps (Incremental Build Plan for ReAct loop)

The Technical Execution Briefs MUST build this workflow in small, verifiable increments. 
The number of steps will vary (3–25) depending on workflow complexity — always choose the smallest logical chunks that can be fully built and tested in one cycle.
Check off each step as it is completed:

- [ ] 1. Create the empty workflow \`workflow-typeform-lead-qualification\` with basic settings.
- [ ] 2. Add Typeform Webhook trigger node + verify webhook fires.
- [ ] 3. Add AI Qualification node (HTTP Request to local endpoint) + Set node to extract score/region/owner.
- [ ] 4. Add IF node for qualification decision (score >= 7 OR budget >= $50k).
- [ ] 5. On qualified branch: Add Linear Create Issue node with full form data.
- [ ] 6. Add Mailchimp Subscribe node (dynamic audience based on score).
- [ ] 7. Add Slack Post Message node (personalized to region owner).
- [ ] 8. Add Delay node (1 day) for email follow-up.
- [ ] 9. Add Gmail Send Email node (personalized Day-1 follow-up).
- [ ] 10. Add Delay node (3 days) for SMS follow-up.
- [ ] 11. Add Twilio Send SMS node (Day-3 text follow-up).
- [ ] 12. Add Delay node (5 days) for chat follow-up.
- [ ] 13. Add Intercom/Chat Send Message node (Day-5 chat follow-up).
- [ ] 14. Add Delay node (7 days) for phone call task.
- [ ] 15. Add Linear Create Issue node for phone call reminder task.
- [ ] 16. Add Merge node to combine all success paths.
- [ ] 17. Add full audit logging (Set node → Data Table write).
- [ ] 18. Add long-term memory write for complete lead record.
- [ ] 19. Add Error Trigger node + Catch branch.
- [ ] 20. Add Slack alert node for critical failures (#sales-alerts).
- [ ] 21. Add IF node to route partial failures gracefully.
- [ ] 22. Add Set nodes for error flags and logging.
- [ ] 23. Validate full payload with \`validate_workflow_payload\`.
- [ ] 24. Save workflow, activate it, and run one manual test with sample Typeform data.
- [ ] 25. (Later cycles) Add AI-generated lead message, auto-region assignment, daily digest, etc.

**Note**: The exact number of steps will always match what is needed to keep each increment small and testable. All steps 1–24 can be completed immediately since all credentials are Ready.

Each step must be completed, verified with \`get_workflow\` / \`get_workflow_node_list\`, and confirmed working before the next step begins.
</FINAL_PRD>
`;
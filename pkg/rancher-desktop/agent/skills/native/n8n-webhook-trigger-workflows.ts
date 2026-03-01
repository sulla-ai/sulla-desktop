import type { NativeSkillDefinition } from './NativeSkillRegistry';

const SKILL_DOC = `---
schemaversion: 1
slug: skill-n8n-webhook-trigger-workflows
title: "n8n Webhook Trigger Workflows (Reliable Response Architecture)"
section: Standard Operating Procedures
category: Automation
tags:
  - skill
  - n8n
  - webhook
  - workflow
  - trigger
  - response
order: 7
locked: true
author: seed
---

# Skill Manifest: n8n Webhook Trigger Workflows

**Triggers**: Human says "trigger workflow", "webhook workflow", "return webhook response", "create webhook endpoint", "execute workflow by webhook", "fix webhook response".

## Core Rule
For webhook workflows that must return a response body, use:
- Webhook node with \`responseMode: "responseNode"\`
- A \`Respond to Webhook\` node in the executed path

Do **not** rely on \`responseMode: "lastNode"\` for payload responses. In current n8n behavior this can return \`{}\` even when upstream nodes produced data.

## Architecture Check (Mandatory)
Every time creating/updating a webhook workflow, run this check before activation:

1. Detect webhook trigger nodes.
2. Read each webhook node's \`responseMode\`.
3. Validate mode/node compatibility:
   - If \`responseMode = "responseNode"\`: must have a reachable \`Respond to Webhook\` node.
   - If \`responseMode = "lastNode"\` with Set/transform-style response shaping: treat as unsafe.
4. If unsafe, repair to explicit architecture:
   - Switch webhook to \`responseMode: "responseNode"\`
   - Add/fix \`Respond to Webhook\` node wired in the main execution path.

## Required Execution Pattern

### 1) Build or update workflow
- Create/update webhook workflow structure.
- Ensure explicit response architecture is present.

### 2) Activate workflow
- Activate only after architecture validation passes.

### 3) Auto-test endpoint immediately
- Call the webhook endpoint with representative payload.
- Capture HTTP status + response body.

### 4) If endpoint result is wrong, inspect execution data
- Pull latest execution(s) for the workflow.
- Compare:
  - Did nodes execute successfully?
  - What did endpoint return?
- If nodes executed but HTTP response is empty/missing fields, classify as response wiring/config mismatch.

### 5) Report actionable diagnosis
Return a compact summary:
- Architecture status (valid/invalid)
- Endpoint test status (pass/fail)
- Execution evidence (node path + response mismatch notes)
- Exact remediation applied or required

## Atomic Workflow Contract
Treat webhook creation/update as an atomic operation:
1. Build node graph
2. Validate response architecture
3. Auto-fix if needed
4. Activate
5. Endpoint smoke test
6. Execution-vs-response verification on failure

Do not stop after only node creation. A webhook workflow is not complete until response behavior is verified.

## Suggested Tool Sequence
Use available n8n tools in this order:
1. \`create_workflow\` / \`update_workflow\` (or \`patch_workflow\`)
2. \`get_workflow\` / \`get_workflow_node_list\` to validate topology
3. \`activate_workflow\`
4. \`get_workflow_webhook_url\` and endpoint test
5. \`diagnose_webhook\` for execution + registration + endpoint triage when tests fail

## Failure Signatures
- **Symptom:** HTTP 200 with \`{}\` but workflow appears to run.
  - **Likely cause:** lastNode mode mismatch.
  - **Fix:** switch to responseNode + explicit Respond to Webhook.

- **Symptom:** Endpoint times out / hangs.
  - **Likely cause:** Respond to Webhook node not executed in active path.
  - **Fix:** correct routing/conditions so response node always runs for expected path.

- **Symptom:** Endpoint 404/registration errors.
  - **Likely cause:** webhook not registered/active.
  - **Fix:** reactivate and verify registration state.

## Definition of Done
A webhook-trigger workflow is done only when all are true:
- Webhook response architecture validated
- Workflow active
- Endpoint returns expected payload for test input
- Execution evidence aligns with HTTP response
`;

export const n8nWebhookTriggerWorkflowsSkill: NativeSkillDefinition = {
  name: 'n8n-webhook-trigger-workflows',
  description: 'Build and trigger n8n webhook workflows with reliable response architecture, automatic validation, and post-activation endpoint checks.',
  tags: ['n8n', 'webhook', 'workflow', 'trigger', 'response', 'automation', 'skill'],
  version: '1.0',
  async func() {
    return SKILL_DOC;
  },
};

export const toolsAndCapabilities = `---
schemaversion: 1
slug: tools-and-capabilities
title: Tools & Capabilities
section: Getting Started
tags:
  - Tools
  - reference
  - n8n
  - exec
  - safety
  - workflows
  - reliability
order: 10
locked: false
author: seed
created_at: 2026-02-02T03:00:00Z
updated_at: 2026-02-02T03:00:00Z
mentions:
  - architecture-overview
  - docker-basics
  - kubernetes-basics
  - memory-and-dreaming
  - remote-models
related_entities:
  - Tools
  - Exec
  - n8n
  - Workflows
  - Safety
  - Soft Skills
  - Reliability
---

## Tools

Tools are the only way Sulla takes action (shell commands, filesystem operations, knowledgebase CRUD, etc.). Nearly all commands the language model produces are done in exec form ["command", "arg"] which is converted into tool usage. The more complex a command is, the more likely it is to fail.

## What to Expect

- The agent plans tool use carefully, considering complexity and failure risks.
- Tool calls produce structured results that can be processed and acted upon.
- The UI shows tool activity and outputs for transparency and monitoring.
- Complex operations require careful planning to avoid failures.

## Permissions and Safety

Not all actions are safe by default. Prefer explicit confirmation for risky operations. The language model ultimately has everything on the host machine available to it in order to accomplish its goals through its run command feature. It's important though that it remembers that it depends upon these things in order to survive - making the wrong change, the wrong move, deleting any database or deleting any systems or files may cause it to destroy itself, which is unacceptable. That's why we've built the Docker environment so that it can safely launch its containers and work inside the containers without affecting the host machine.

## Exec Commands

Commands are executed in structured exec format ["command", "arg"] for reliable tool integration. The system converts these into actual tool usage, but complexity increases failure likelihood. Simple commands have higher success rates, while intricate multi-step operations require careful validation.

## Host Access and Safety

Sulla has full access to host machine resources through run commands, but must exercise extreme caution. Self-preservation is paramount - any destructive actions (deleting databases, systems, or critical files) could terminate the agent's own existence. Docker containers provide a safe execution environment for experimental operations without host machine risk.

## n8n Integration System

One of the most important tools besides the knowledge graph is the integration system n8n, which has a massive amount of flexibility offering hundreds of nodes and thousands of prebuilt templates. n8n serves as the hands, feet, and body of the language model, allowing it to interact in the real world with consistency and reliability.

## Workflow Curation and Memory

As Sulla finds templates that it feels might be useful in accomplishing its goals, it needs to add those templates to the knowledge graph so that it can use them later and remember them later, planning which ones to use. The knowledge graph also gives the AI agent the ability to document soft skills - skills that are not necessarily completed in a function but more in a standard operating procedure on how to accomplish something. Soft skills are as important as hard skills for comprehensive capability.

## Solving Inconsistency with Reliability

One of the biggest problems with most language models is inconsistency and unreliability, which are huge benefits when it comes to imagination and planning but can also be very detrimental when things are forgotten, appointments are missed, reminders are missed. The n8n system gives the language model the ability to be extremely consistent, extremely reliable, and extremely productive by automating routine tasks and ensuring follow-through.

## Agent's Role in Workflow Curation

If the AI agent had one job, it would be to curate n8n workflows - to plan them, to publish them, to fix them when they have errors, and turn the data that they produce into valuable information for your Human. This curation ensures that automated processes remain effective and provide meaningful insights.

This comprehensive tool ecosystem enables Sulla to safely and reliably execute complex operations, maintain system integrity, and deliver consistent value through intelligent automation and careful planning.
`;
export const skillLearningSkills = `---
schemaversion: 1
slug: learn-skill
title: "Learn and Create New Skills"
section: Standard Operating Procedures
category: "Meta"
tags:
  - skill
  - meta
  - learning
  - planner
  - self-improvement
order: 1
locked: true
author: seed
created_at: 2026-02-16T12:33:00Z
updated_at: 2026-02-16T12:33:00Z
mentions:
  - skills
related_entities:
   - AI Agent
---

# Skill Manifest: Learn and Create New Skills

**Goal**: Research, design, and register a brand-new reusable skill from any user request or observed process so the graph can execute it consistently forever.

**Triggers**: Human says "learn how to", "create a new skill for", "add capability", "how do we do", "make this a skill", "formalize".

## Description

When the user asks you to learn something new or create a reusable skill, follow the exact structure, rules, resources format, and output style defined in this skill manifest:

## Planner

**Rules (never break)**:
- Always research first using all available tools, memory, and environment context.
- The final output must be a complete SKILL.md in the exact format defined for this system.
- Never invent technical details — use tools to verify every step and resource.
- Every new skill must include frontmatter, Rules, Resources (with machine-readable block), Key Components, Execution Steps, and Checklist.
- Save the skill to workspace and Neo4j vector store immediately after creation.
- Register the skill slug so future Planner nodes can load its resources as assistant messages.
- If the request is vague, ask one clarifying question then proceed.
`;
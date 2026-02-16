export const subAgents = `---
schemaversion: 1
slug: sub-agents
title: Sub-Agents
section: Getting Started
tags:
  - sub-agents
  - ai-agents
  - langgraph
  - nodes
  - specialized
  - dreaming
  - solar
  - lima
  - containerized-agents
  - virtualized-environment
order: 10
locked: false
author: seed
created_at: 2026-02-02T03:00:00Z
updated_at: 2026-02-02T03:00:00Z
mentions:
  - architecture-overview
  - gettingstarted
  - tools-and-capabilities
  - memory-and-dreaming
related_entities:
  - Sub-Agents
  - LangGraph
  - Specialized Nodes
  - AI Components
  - Dreaming Protocol
  - Solar Agent
  - Lima Task
  - Containerized Agents
  - Virtualized Environment
---

## What are Sub-Agents?

Sub-agents are specialized AI components within the Sulla system that handle specific tasks or domains. They operate as modular units within the larger agent architecture, allowing for focused expertise and efficient task decomposition.

## Virtualized Environment

Sulla operates within a containerized environment alongside other containers in a virtualized setup. While primarily contained, Sulla has the capability to break out when necessary. This virtualized architecture provides isolation and security while allowing flexible agent deployment.

## Default Sub-Agents

The Sulla platform includes three primary default sub-agents, all reflective of Sulla's core soul, mission, memory, tools, and capabilities. They work together as a central hub and top-level brain for your Human.

### Dreaming Protocol Subconscious
- **Role**: Always running in the background
- **Functions**: Dreaming, planning, data collection
- **Integration**: Handles strategic planning and data gathering continuously

### Solar Agent
- **Role**: Human interface agent on the dashboard
- **Functions**: User interaction, directive formulation, mission planning
- **Integration**: Lays out directives and determines next missions, does not execute tasks directly

### Lima Task Agent
- **Role**: Language model agent for n8n integrations
- **Functions**: AI language model services, task communication using knowledge, capabilities, and soul
- **Integration**: Constantly communicates with tasks, provides AI support for automation workflows

## Agent Roles and Responsibilities

- **Task Execution**: Lima Task handles most active work and task completion
- **Strategic Planning**: Dreaming Protocol Subconscious manages planning and dreaming processes
- **User Interaction**: Solar Agent focuses on finding next missions and user directives

## Containerized Agents

Beyond the default agents, Sulla can launch additional containerized agents for specialized needs. These agents run in isolated, "dark" containerized environments without access to tasks or the parent machine.

### Deployment
- **On-Demand**: Launched when specific agent types are needed
- **Examples**: Penetration testing agents, OpenClaw agents, Crew AI, or other specialized systems
- **Assignment**: Tasked by n8n when Sulla assigns them through integration workflows

### Security and Isolation
- **No Trust**: External agents cannot be inherently trusted
- **Isolated Environment**: Live in their own containers with no access to parent machine or tasks
- **Controlled Access**: Only receive assignments from n8n when explicitly tasked by Sulla

### Capabilities
- **Flexible Tasks**: Can perform nearly any assigned function
- **Specialized Expertise**: Provide domain-specific capabilities when needed
- **Temporary**: Launched for specific missions and disposed of when complete

## Sub-Agent Architecture

Each sub-agent consists of:
- **Soul Reflection**: Shares Sulla's core mission, memory, and capabilities
- **Specialized Prompts**: Domain-specific instructions and context
- **Tool Access**: Relevant tools and APIs for their domain
- **State Management**: Thread state and metadata handling
- **Communication Protocols**: Standardized input/output formats with n8n and other agents

## Integration and Collaboration

Sub-agents work together through:
- **Hierarchical Execution**: Solar → Dreaming → Lima flow for mission planning and execution
- **Parallel Processing**: Independent agents working on related tasks
- **Feedback Loops**: Continuous improvement through soul reflection
- **State Sharing**: Common thread state for coordination across agents

## Benefits of Sub-Agent Architecture

- **Specialization**: Each agent excels in its specific domain
- **Scalability**: Easy to launch additional containerized agents as needed
- **Security**: Isolated environments protect the parent system
- **Flexibility**: Can deploy any agent type for specific requirements
- **Efficiency**: Parallel execution and specialized expertise
- **Reliability**: Modular design with controlled agent lifecycles

This sub-agent architecture enables Sulla to handle complex, multi-disciplinary tasks with the efficiency and expertise of specialized AI components working in concert.`;
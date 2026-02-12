export const dockerBasics = `---
schemaversion: 1
slug: docker-basics
title: Docker in Sulla
section: Getting Started
tags:
  - Docker
  - basics
  - lima
  - kubernetes
  - virtualization
  - ai-agent
  - containers
order: 10
locked: true
author: seed
created_at: 2026-02-02T03:00:00Z
updated_at: 2026-02-02T03:00:00Z
mentions:
  - architecture-overview
  - kubernetes-basics
  - tools-and-capabilities
  - memory-and-dreaming
related_entities:
  - Docker
  - Lima
  - Kubernetes
  - AI Agent
  - Virtualization
  - Containers
---

## Docker Setup in Sulla

Sulla Desktop integrates Docker and Kubernetes through a Lima virtual machine, providing the AI agent with powerful containerization capabilities while maintaining isolation and safety.

## Lima Virtual Machine

The application uses a Lima virtual machine to host containerized workloads:

- **Lima VM**: Lightweight virtualization layer that runs on macOS
- **Container Runtime**: Supports both Docker containers and Kubernetes clusters
- **Lifecycle**: Containers run only when the Sulla desktop application is active
- **Persistence**: VM state persists across application restarts

## AI Agent Control

The AI agent "Sulla" has full control over the container environment:

- **Command Line Tools**: Access to kubectl, nerdctl, rdctl, and Docker CLI
- **Container Management**: Can create, modify, and destroy containers autonomously
- **Kubernetes Operations**: Full cluster management capabilities
- **Purpose**: Designed primarily for the AI agent, not end-user interaction

## Container Usage for AI Tasks

Sulla leverages containers for various AI-driven purposes:

- **Custom Deployments**: Launch systems needed to accomplish goals
- **Virtual AI Agents**: Run isolated AI instances for specialized tasks
- **Project Development**: Create containerized environments for coding and testing
- **Safety Isolation**: Protect the host machine from experimental or potentially harmful operations

## Configuration Options

The setup supports different container orchestration modes:

- **Docker Mode**: Traditional container runtime with docker commands
- **Kubernetes Mode**: Full K8s cluster with pods, services, and deployments
- **Hybrid Mode**: Mix of standalone containers and orchestrated services

## Safety Considerations

While powerful, the container system requires careful management:

- **Agent Autonomy**: Sulla can modify all application settings via database or tools
- **Irreversible Changes**: Critical configuration changes could shut down the entire system
- **Host Protection**: Containers isolate potentially dangerous operations from the primary machine
- **Monitoring**: Continuous oversight prevents system-killing actions

## Integration with Architecture

Docker/Kubernetes ties directly into Sulla's core systems:

- **Neo4j Brain**: Containers can be used to extend the agent's cognitive capabilities
- **Tool Ecosystem**: Containerized tools expand the agent's operational reach
- **Memory Systems**: Isolated environments for long-term knowledge storage
- **Goal Achievement**: Dynamic container deployment supports complex task execution

## Common Tasks

Basic container operations available to the AI agent:

- Verify container runtime status
- List running containers/pods
- Create and manage containerized services
- Handle networking between containers
- Manage persistent volumes and data
- Scale services based on computational needs

This containerization layer provides Sulla with a flexible, safe, and powerful execution environment for achieving its objectives while maintaining system integrity.`;
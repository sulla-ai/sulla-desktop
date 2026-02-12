export const kubernetesBasics = `---
schemaversion: 1
slug: kubernetes-basics
title: Kubernetes in Sulla
tags:
  - Kubernetes
  - basics
  - lima
  - orchestration
  - ai-agent
  - containers
order: 10
locked: true
author: seed
created_at: 2026-02-02T03:00:00Z
updated_at: 2026-02-02T03:00:00Z
mentions:
  - architecture-overview
  - docker-basics
  - tools-and-capabilities
  - memory-and-dreaming
related_entities:
  - Kubernetes
  - Lima
  - AI Agent
  - Containers
  - Orchestration
---

## Kubernetes Setup in Sulla

Sulla Desktop integrates Kubernetes through a Lima virtual machine, providing the AI agent with powerful container orchestration capabilities for complex, multi-component workloads while maintaining isolation and scalability.

## Why Kubernetes

A local Kubernetes cluster running in a Lima VM enables repeatable dev/test environments and orchestration of multi-component workloads. Unlike Docker's single-container focus, Kubernetes excels at managing distributed applications with automatic scaling, self-healing, and service discovery.

## Lima Virtual Machine

The Kubernetes integration builds on the same Lima virtualization layer as Docker:

- **Lima VM**: Lightweight virtualization providing isolated container runtime
- **Kubernetes Distribution**: Full K8s cluster with control plane and worker nodes
- **Lifecycle**: Cluster runs only when the Sulla application is active
- **Resource Management**: Configurable CPU, memory, and storage allocation

## AI Agent Control

The AI agent "Sulla" has complete control over the Kubernetes cluster:

- **kubectl Access**: Full command-line interface for cluster management
- **API Integration**: Direct access to Kubernetes API server
- **Workload Management**: Autonomous deployment, scaling, and monitoring of pods
- **Configuration Changes**: Ability to modify cluster settings and policies

## Core Kubernetes Concepts

Essential concepts for understanding K8s in Sulla:

- **Cluster & Nodes**: Control plane managing worker nodes running containers
- **Namespaces**: Logical partitioning for organizing resources
- **Pods**: Smallest deployable units containing one or more containers
- **Deployments**: Declarative updates for pod management and scaling
- **Services**: Network abstractions exposing pods internally/externally
- **ConfigMaps & Secrets**: Configuration and sensitive data management

## Orchestration for AI Tasks

Sulla leverages Kubernetes for sophisticated AI-driven operations:

- **Multi-Container Applications**: Complex systems with interdependent services
- **Scalable AI Workloads**: Dynamic pod scaling based on computational needs
- **Microservices Architecture**: Modular AI components running as separate services
- **Load Balancing**: Automatic distribution of AI processing tasks
- **Rolling Updates**: Zero-downtime updates for AI model deployments

## Configuration Modes

Sulla supports different container runtime modes:

- **Kubernetes Mode**: Full orchestration with pods, services, and deployments
- **Docker Mode**: Traditional single-container management
- **Hybrid Mode**: Mix of orchestrated and standalone containers

## Safety and Isolation

Kubernetes provides enhanced safety measures:

- **Namespace Isolation**: Resource separation between different AI projects
- **Network Policies**: Fine-grained control over pod communication
- **Resource Limits**: Preventing resource exhaustion by AI workloads
- **RBAC**: Role-based access control for secure agent operations

## Integration with Architecture

Kubernetes ties deeply into Sulla's core systems:

- **Neo4j Brain**: Cluster state and AI knowledge stored in graph database
- **Tool Ecosystem**: Containerized tools extend agent's operational reach
- **Memory Systems**: Persistent volumes for long-term AI memory storage
- **Goal Achievement**: Orchestrated deployments support complex task execution

## Common Tasks

Key operations available to the AI agent:

- Verify cluster health and node status
- Deploy and manage pod-based applications
- Scale deployments based on workload demands
- Inspect logs and monitor pod events
- Apply Kubernetes manifests and perform rollouts
- Manage persistent volumes and storage classes
- Configure networking and service discovery
- Implement security policies and resource quotas

This orchestration layer enables Sulla to manage sophisticated, distributed AI systems while maintaining system integrity and providing scalable computational resources for achieving complex objectives.
`;
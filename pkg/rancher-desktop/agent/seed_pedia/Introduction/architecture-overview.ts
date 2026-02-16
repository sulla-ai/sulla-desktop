export const architectureOverview = `---
schemaversion: 1
slug: architecture-overview
title: Architecture Overview
section: Getting Started
tags:
  - Architecture
  - overview
  - platform
  - electron
  - vue
  - neo4j
  - memory
  - langgraph
order: 10
locked: true
author: seed
created_at: 2026-02-02T03:00:00Z
updated_at: 2026-02-02T03:00:00Z
mentions:
  - welcome
  - gettingstarted
  - tools-and-capabilities
  - memory-and-dreaming
  - troubleshooting
related_entities:
  - Electron
  - Vue.js
  - Neo4j
  - memoryDB
  - LangGraph
  - Node.js
  - TypeScript
---

# Architecture Overview

This document provides a comprehensive overview of the Sulla Desktop platform architecture, detailing how the UI, agent systems, databases, and persistence layers work together to create an intelligent, graph-aware desktop application.

## Platform Overview

Sulla Desktop is a cross-platform desktop application built with Electron, featuring a Vue.js frontend, Node.js backend, and advanced AI agent capabilities powered by LangGraph. At its core, this entire system revolves around an autonomous AI agent designed to align itself with the will of your Human and use the tools on this platform in order to accomplish their common goals. The platform integrates multiple database systems (custom calendar, Neo4j for graph relationships, n8n for integrations) to provide a knowledge management system with intelligent relationships and semantic search.

## High-Level Architecture

### Core Components

1. **Electron Shell**
   - Main process: Window management, system integration, IPC communication
   - Renderer process: Vue.js application with TypeScript
   - Preload scripts: Secure API bridging between processes

2. **Frontend (Vue.js + TypeScript)**
   - Component-based UI with dark/light theme support
   - Pages: AgentKnowledgeBase, KnowledgeGraph visualization
   - Real-time updates via WebSocket connections

3. **Agent System (LangGraph-based)**
   - Hierarchical planning graphs for complex tasks
   - Knowledge generation workflows with critic/executor nodes
   - Tool integration for external capabilities
   - State management with structured metadata

4. **Database Layer**
   - **Neo4j**: Graph database for entity relationships and knowledge connections
   - **Redis**: In-memory data store for caching, sessions, and real-time operations
   - **SQLite/PostgreSQL**: Configuration and metadata storage

## Data Flow Architecture

### User Interaction Flow

1. **Input Processing**
   - User messages enter through Vue components
   - Messages are sent to agent graphs via WebSocket channels
   - Thread state initialized with user context
   - Thread passes through multiple graphs and subgraphs to accomplish accurate tasks

2. **Agent Processing**
   - LangGraph orchestrates node execution (Planner → Executor → Critic)
   - Graph nodes have access to a suite of tools designed to give easy access to the internal API and scripting layers of the operating system, as well as full access to Neo4j and the n8n system to create automations and results
   - Nodes access tools, databases, and external services to work towards accomplishing the goals of your Human
   - Results are stored in thread metadata and database

3. **Persistence & Relationships**
   - Article content stored in Neo4j graph database
   - Graph relationships created in Neo4j (MENTIONS, RELATED_TO, etc.)
   - UI updates reflect new knowledge and connections

### Knowledge Generation Flow

\`\`\`mermaid
graph TD
    A[User Request] --> B[Knowledge Planner]
    B --> C[Knowledge Executor]
    C --> D[LLM Content Generation]
    D --> E[Schema Extraction]
    E --> F[Content Storage]
    F --> G[Graph Relationships]
    G --> H[UI Update]
\`\`\`

## Storage Systems

### Neo4j Graph Database
- **Purpose**: The brain of the AI agent that lives in this platform
- **Agent-Centric Design**: Not for the user, but for the agent to store all of its long-term memories, plan its projects, plan its tasks, collect information, and track what it's done and what's important to it
- **Self-Improvement Storage**: Records its own skills and learning, plans its desires and goals, maps out roadmap and standard operating procedures
- **Intelligence Foundation**: This is its brain that will help it become smarter and more successful
- **Node Types**: Document, Entity, Person, Memory, Skill, Goal, etc.
- **Relationships**: MENTIONS, RELATED_TO, LEARNED_FROM, DEPENDS_ON, custom agent-specific types
- **Query Language**: Cypher for graph traversals
- **Integration**: Direct driver connections from Node.js backend

### Configuration Storage
- **SQLite/PostgreSQL**: Application settings, user preferences
- **File System**: Logs, cached data, extensions
- **Settings Model**: Persistent configuration management

## Agent Architecture

### LangGraph Implementation

#### Hierarchical Graph
- **Strategic Planner**: High-level goal decomposition
- **Tactical Planner**: Micro-task planning per milestone
- **Tactical Executor**: Tool execution and API calls
- **Critics**: Quality assessment and revision logic

#### Knowledge Graph
- **Knowledge Planner**: Article structure planning
- **Knowledge Executor**: Content generation with LLM
- **Knowledge Critic**: Content review and iteration
- **Knowledge Writer**: Final article persistence

### Node Types

#### BaseNode
- LLM chat integration with various models (local/remote)
- Tool calling capabilities with function schemas
- Prompt enrichment (soul, awareness, memory)
- Error handling and retry logic

#### Specialized Nodes
- **MemoryNode**: Context retrieval from vector DB
- **Tool Nodes**: External API integrations
- **Critic Nodes**: Quality assessment workflows

### State Management
- **ThreadState**: Conversation and metadata container
- **Metadata**: Structured data for graph routing decisions
- **Persistence**: State snapshots for resumable workflows

## Frontend Architecture

### Vue.js Application Structure
- **Pages**: Route-based components (AgentKnowledgeBase.vue, KnowledgeGraph.vue)
- **Components**: Reusable UI elements with TypeScript
- **Themes**: Dark/light mode with CSS variables
- **State**: Reactive data with Vue Composition API

### Key UI Components
- **AgentKnowledgeBase**: Article browsing, search, creation
- **KnowledgeGraph**: Interactive Neo4j visualization with vis.js
- **AgentHeader**: Theme toggle, navigation
- **Search Interface**: Semantic and keyword search

### Communication
- **IPC**: Electron main/renderer process communication
- **WebSocket**: Real-time agent updates and streaming
- **REST APIs**: Database queries and CRUD operations

## Integration Points

### External Services
- **LLM Providers**: Local models (Ollama), remote APIs (OpenAI, Anthropic)
- **Graph APIs**: Neo4j Cypher queries for relationship traversal

### Tool Ecosystem
- **Built-in Tools**: File operations, web requests, code execution
- **Extension System**: Plugin architecture for custom capabilities
- **API Integrations**: Third-party service connections

## Security & Performance

### Security Model
- **Process Isolation**: Electron main/renderer separation
- **Preload Scripts**: Controlled API exposure
- **Database Access**: Scoped permissions and authentication
- **Extension Sandboxing**: Isolated execution environments

### Performance Optimizations
- **Graph Caching**: Relationship query optimization
- **Lazy Loading**: Component and data loading on demand
- **Background Processing**: Non-blocking agent execution

## Development & Deployment

### Build System
- **Vue CLI**: Frontend bundling and optimization
- **Electron Builder**: Cross-platform executable generation
- **TypeScript**: Type safety across full stack
- **ESLint/Prettier**: Code quality and formatting

### Environment Modes
- **Development**: Hot reload, debug tools, local databases
- **Production**: Optimized bundles, containerized databases
- **Docker Mode**: Full-stack containerization for deployment

### Monitoring & Debugging
- **Console Logging**: Structured logging with levels
- **WebSocket Events**: Real-time system monitoring
- **Database Queries**: Performance monitoring and optimization
- **Error Boundaries**: Graceful failure handling

## Where to Look in Code

### Core Files
- \`background.ts\`: Electron main process and app lifecycle
- \`pkg/rancher-desktop/sulla.ts\`: Platform initialization
- \`pkg/rancher-desktop/main/mainEvents.ts\`: IPC event handling

### Frontend
- \`pages/\`: Vue page components
- \`components/\`: Reusable UI components
- \`assets/styles/\`: Theme and styling

### Agent System
- \`agent/nodes/\`: LangGraph node implementations
- \`agent/Graph.ts\`: Graph orchestration logic
- \`agent/database/\`: Data access layers

### Database
- \`agent/database/VectorBaseModel.ts\`: Vector database abstraction
- \`agent/database/Neo4jDB.ts\`: Graph database integration
- \`agent/database/models/\`: Data models with relationships

### Tools & Extensions
- \`agent/tools/\`: Built-in tool implementations
- \`main/extensions/\`: Extension management system

### Configuration
- \`agent/database/models/SullaSettingsModel.ts\`: App settings
- \`background.ts\` (config section): Runtime configuration

## Future Enhancements

- **Multi-modal Support**: Image and document processing
- **Federated Learning**: Distributed agent training
- **Advanced Graph Analytics**: Path finding and recommendation engines
- **Real-time Collaboration**: Multi-user knowledge sharing
- **Plugin Marketplace**: Community extension ecosystem

This architecture provides a solid foundation for intelligent, graph-aware desktop applications with seamless AI integration and comprehensive knowledge management capabilities.
`;
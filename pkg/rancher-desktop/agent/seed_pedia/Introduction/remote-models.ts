export const remoteModels = `---
schemaversion: 1
slug: remote-models
title: Remote Models (Benefits & Risks)
section: Getting Started
tags:
  - Models
  - remote
  - llm
  - performance
  - configuration
  - openai
  - anthropic
order: 20
locked: false
author: seed
created_at: 2026-02-02T03:00:00Z
updated_at: 2026-02-02T03:00:00Z
mentions:
  - architecture-overview
  - gettingstarted
  - tools-and-capabilities
  - memory-and-dreaming
  - ollama-local-models
related_entities:
  - Remote Models
  - LLM
  - GPU
  - Performance
  - Configuration
  - OpenAI
  - Anthropic
---

## Why Remote Models

Remote providers can offer higher capability models and faster iteration without local hardware limits. Remote models are going to be the most performant; typical laptop computers are not built with lots of GPU or in a way that they can even utilize the GPU they have. Whereas remote LLM models are built upon massive GPU servers with lots of RAM that give them the ability to respond in milliseconds.

The more intelligent language model that you can afford will produce far greater results than the cheaper weaker models. Investing in higher-quality remote models yields significantly better outcomes for complex reasoning, creativity, and problem-solving tasks.

## Performance Benefits

- **Massive GPU Infrastructure**: Remote models run on dedicated server farms with hundreds of high-end GPUs
- **Abundant RAM**: Tens to hundreds of gigabytes of RAM enable processing of large contexts
- **Millisecond Response Times**: Optimized infrastructure delivers near-instantaneous responses
- **Scalability**: Automatic scaling handles varying loads without performance degradation

## Model Selection

Choose remote models based on your needs and budget:

- **OpenAI GPT-4**: Excellent general intelligence, strong reasoning, good for complex tasks
- **Anthropic Claude**: Superior safety and alignment, good for creative and analytical work
- **Cost vs. Capability Trade-off**: Higher-tier models (GPT-4, Claude Opus) provide dramatically better results than entry-level models

## Configuration

Remote models are configured through Sulla's settings system:

- **Location**: Settings accessible via \`agent/database/models/SullaSettingsModel.ts\` or background configuration
- **API Keys**: Securely store API keys for each provider (OpenAI, Anthropic, etc.)
- **Model Selection**: Choose specific model versions (GPT-4, Claude-3-Opus, etc.)
- **Parameters**: Configure temperature, max tokens, and other generation parameters
- **Fallback Options**: Set backup models if primary provider is unavailable

## Usage in Sulla

Remote models integrate seamlessly into Sulla's agent system:

- **Agent Nodes**: BaseNode implementations can use remote models via API calls
- **Automatic Selection**: System chooses appropriate model based on task complexity
- **Context Management**: Efficient prompt engineering maximizes model capabilities
- **Rate Limiting**: Built-in throttling prevents API quota exhaustion

## Risks

- Data exposure outside the machine
- Compliance and policy constraints
- Prompt/response retention by provider
- API costs and rate limiting
- Dependency on internet connectivity

## Best Practices

- Keep secrets/PII out of prompts
- Use remote only when needed for complex tasks requiring high intelligence
- Prefer explicit user control over what is sent
- Monitor API usage and costs
- Implement fallback strategies for network issues
- Regularly rotate API keys for security

## When to Use Remote vs Local

- **Use Remote**: Complex reasoning, creative tasks, large context processing, when local models can't handle the task
- **Use Local**: Simple tasks, offline operation, privacy-critical content, cost-sensitive scenarios
- **Hybrid Approach**: Start with local models, escalate to remote for challenging tasks

This balance ensures optimal performance and cost-efficiency while maintaining the flexibility to tackle any AI challenge.
`;
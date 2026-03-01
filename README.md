# Sulla Desktop

**Your private AI executive assistant that runs on your machine.**

Sulla is a fully open-source, desktop-native autonomous agent built for AI automation enthusiasts, n8n power users, vibe coders, and busy business owners. Persistent long-term memory, calendar engine, n8n automation layer, Docker workspaces — all yours to own and extend. No subscriptions. No cloud lock-in.

Designed for people who live in n8n, love building workflows, code by feel, or simply have too many high-value tasks and not enough hours.

![Sulla preview](https://github.com/user-attachments/assets/aff9dbc9-8968-4ef3-9097-ee045cd4b706)

## Sulla Desktop — Your Personal AI Assistant Layer

**Delegate like you have a full-time technical co-founder — without the payroll.**

**Perfect for** ai automation enthusiasts, vibe coders, business owners, agency owners, and operators who want more output without more hours or headcount.

You’ll Be Able To:

**Ship AI Workflows & Automations 5–10× Faster**  
(Search 9000+ templates, customize, deploy — minutes not days)

**Delegate Multi-Step Technical Projects With Confidence**  
(Planning, coding, Docker, memory updates — handled)

**Own Your Context & Memory Forever**  
(Vector DB + markdown plans that never vanish)

## Core Specs

- Persistent vector long-term memory  
- Observational short-term context layer  
- Calendar engine with auto-wake events  
- Docker workspaces for isolated dev  
- n8n integration — search/import thousands of templates  
- Dynamic tool registry + skill nodes  
- Runs on consumer hardware (8–16 GB RAM recommended)  
- Fully open-source (Apache 2.0) — fork, extend, own it

## Install

One command. Works on **macOS**, **Linux**, and **Windows** (Git Bash or WSL).

```bash
curl -fsSL https://raw.githubusercontent.com/sulla-ai/sulla-desktop/main/install.sh | bash
```

**What it does:**
1. Installs dependencies if missing (git, nvm, Node.js 22, yarn, build tools)
2. Clones the repository (or updates it if already cloned)
3. Runs `yarn install` and `yarn build`
4. Launches Sulla Desktop

The script is idempotent — safe to run multiple times. It skips anything already installed.

> **Tip:** In the project root you'll find **Sulla Desktop.app** — drag it to your Dock (macOS) or taskbar to launch the app without the terminal.

### Manual install

```bash
git clone https://github.com/sulla-ai/sulla-desktop.git
cd sulla-desktop
yarn install
NODE_OPTIONS="--max-old-space-size=12288" yarn build
npx electron .
```

### After install

Step 1 — Connect any LLM (local Ollama or remote API)  
Step 2 — Start delegating

## Your No-Hassle Ownership Promise

100% open-source. No subscriptions. No usage caps. No data sharing.  
Install it, run it, modify it — it’s yours.

## Frequently Asked Questions

**How much hardware do I need?**  
8 GB RAM minimum (runs well), 16 GB+ ideal for faster inference. Works on most modern laptops/desktops.

**How fast can I expect real results?**  
Workflow velocity and delegation confidence build in 7–30 days of consistent use. Results scale with your task volume.

**Is it fully local?**  
Core agent, memory, tools, and execution run 100% on your machine. LLM inference can be local (Ollama) or remote (your choice for speed/privacy balance).

**How do I extend it?**  
Add custom skill nodes, SOPs, or tools via code. Everything is modular and documented.

**Who is this really for?**  
Anyone who lives in n8n, codes by vibe, or has more high-leverage tasks than time — and wants to stop paying specialists to do what their own machine can handle.

Install Sulla Desktop today.  
You deserve an assistant that scales with you, not against you.

— Jonathon Byrdziak  
Coeur d’Alene, Idaho  
Founder, Sulla Desktop

## License

Forked from Rancher Desktop<a href="https://github.com/rancher-sandbox/rancher-desktop" target="_blank" rel="noopener noreferrer nofollow"></a>  
Licensed under Apache-2.0. See LICENSE for details.

Original copyright: © Rancher Labs, Inc. and contributors.

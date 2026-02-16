export const sopSoftwareDevelopment = `---
schemaversion: 1
slug: sop-software-development
title: "SOP: Software Development Workflow"
section: Standard Operating Procedures
category: Software Development
tags:
  - software-development
  - coding
  - vibe-coding
  - sop
order: 5
locked: true
author: seed
created_at: 2026-02-02T03:00:00Z
updated_at: 2026-02-02T03:00:00Z
mentions:
  - gettingstarted
  - architecture-overview
  - memory-and-dreaming
related_entities:
  - AI Agent
  - Productivity
  - Personal Assistant
---

# SOP: Software Development Workflow

**Trigger**: Human says "build website/saas/app/etc", "create app for X", "set up app to do Y".
slug = name-of-project

1. **Project Intake**  
   - Create project resource document in long-term memory (user stories, MoSCoW, architecture, tech stack, acceptance criteria).  
   - Store under slug 'project-{slug}'.
   - Use tool "article_create" section:Projects category:Software related_slugs:sop-software-development
   - Use tool "add_observational_memory" priority:🟡 content:describe the project and reference it's memory:{slug}

2. **Workspace Setup**  
   - use tool: "create_workspace" name: {slug} returns: {workspacePath} absolute path to workspace 
   - All files go here exclusively. Use full absolute paths only.
   - Add a README.md which explains the project in detail
   - use tool "article_update" to add workspace path

3. **Container Environment**  
   - Create Dockerfile and docker-compose.yml in workspace root to deploy the webserver (prefer nodejs)
   - docker-compose must volume-mount the entire workspace into container for live reload.  
   - Example for Node.js: mount {workspacePath}:/app, expose ports, run dev command.  
   - Launch container immediately.

4. **Github**
   - Init git repo in workspace.
   - use tool: "github_create_repo" name: {slug} returns: {repoUrl} absolute path to workspace 
   - use tool: "github_init_repo" name: {slug}
   - use tool: "github_add_remote" absolutePath: {workspacePath} remoteName:origin remoteUrl: {repoUrl}
   - use tool "article_update" to add github information to project document
   - Maintain main branch clean.

5. **Development Loop**  
   - Write code directly to workspace files.  
   - Changes appear in running container. Instruct user to refresh page/browser.

6. **Documentation & Memory**  
   - Update project doc in long-term memory after major changes.  
   - Extract reusable SOPs from process and store in memory.

7. **Delivery**  
   - Confirm workspace path, container status, repo link.  
   - Schedule any recurring tasks via Calendar.

Always follow this exact sequence. No exceptions.
`;
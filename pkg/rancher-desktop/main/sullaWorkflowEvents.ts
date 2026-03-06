/**
 * Workflow IPC event handlers for the visual workflow editor.
 * Manages CRUD operations for workflow definitions stored as JSON files.
 */

import * as fs from 'fs';
import * as path from 'path';

import { getIpcMainProxy } from '@pkg/main/ipcMain';
import Logging from '@pkg/utils/logging';

const console = Logging.background;
const ipcMainProxy = getIpcMainProxy(console);

function getWorkflowsDir(): string {
  const { resolveSullaWorkflowsDir } = require('@pkg/agent/utils/sullaPaths');

  return resolveSullaWorkflowsDir();
}

export function initSullaWorkflowEvents(): void {
  // List all workflows (returns array of { id, name, updatedAt })
  ipcMainProxy.handle('workflow-list', async() => {
    const dir = getWorkflowsDir();

    if (!fs.existsSync(dir)) {
      return [];
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const workflows: { id: string; name: string; updatedAt: string }[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      try {
        const filePath = path.join(dir, entry.name);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);

        workflows.push({
          id:        parsed.id || entry.name.replace('.json', ''),
          name:      parsed.name || entry.name.replace('.json', ''),
          updatedAt: parsed.updatedAt || '',
        });
      } catch (err) {
        console.error(`[Sulla] Failed to parse workflow file ${ entry.name }:`, err);
      }
    }

    return workflows;
  });

  // Get a single workflow by ID
  ipcMainProxy.handle('workflow-get', async(_event: unknown, workflowId: string) => {
    const filePath = path.join(getWorkflowsDir(), `${ workflowId }.json`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Workflow not found: ${ workflowId }`);
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  });

  // Save (create or update) a workflow
  ipcMainProxy.handle('workflow-save', async(_event: unknown, workflow: any) => {
    const dir = getWorkflowsDir();

    fs.mkdirSync(dir, { recursive: true });
    workflow.updatedAt = new Date().toISOString();
    if (!workflow.createdAt) {
      workflow.createdAt = workflow.updatedAt;
    }

    const filePath = path.join(dir, `${ workflow.id }.json`);

    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
    console.log(`[Sulla] Workflow saved: ${ workflow.id }`);

    return true;
  });

  // Delete a workflow
  ipcMainProxy.handle('workflow-delete', async(_event: unknown, workflowId: string) => {
    const filePath = path.join(getWorkflowsDir(), `${ workflowId }.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Sulla] Workflow deleted: ${ workflowId }`);
    }

    return true;
  });

  console.log('[Sulla] Workflow IPC event handlers initialized');
}

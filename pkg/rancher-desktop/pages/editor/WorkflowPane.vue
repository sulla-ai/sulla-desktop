<template>
  <div class="workflow-pane" :class="{ dark: isDark }">
    <!-- Tab bar -->
    <div class="workflow-tab-bar" :class="{ dark: isDark }">
      <div class="workflow-tabs-scroll">
        <div
          v-for="tab in openTabs"
          :key="tab.id"
          class="workflow-tab"
          :class="{ active: tab.id === activeTabId, dark: isDark }"
          @click="activateTab(tab.id)"
        >
          <span class="workflow-tab-name">{{ tab.name }}</span>
          <button
            class="workflow-tab-close"
            :class="{ dark: isDark }"
            title="Close"
            @click.stop="closeTab(tab.id)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <button
        class="workflow-tab-add"
        :class="{ active: showingPicker, dark: isDark }"
        title="Open or create workflow"
        @click="togglePicker"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <button class="workflow-pane-close" :class="{ dark: isDark }" title="Close Panel" @click="$emit('close')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- Content area -->
    <div class="workflow-pane-content">
      <!-- Workflow picker (shown when "+" clicked or no tabs open) -->
      <div v-if="showingPicker || openTabs.length === 0" class="workflow-picker" :class="{ dark: isDark }">
        <!-- Create new workflow card -->
        <div
          class="picker-card picker-card-create"
          :class="{ dark: isDark }"
          @click="createNewWorkflow"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span class="picker-card-text">Create New Workflow</span>
        </div>

        <!-- Existing workflows -->
        <div
          v-for="wf in availableWorkflows"
          :key="wf.id"
          class="picker-card"
          :class="{ dark: isDark }"
          @click="openWorkflow(wf.id, wf.name)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="6" height="5" rx="1"/>
            <rect x="16" y="3" width="6" height="5" rx="1"/>
            <rect x="9" y="16" width="6" height="5" rx="1"/>
            <path d="M5 8v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/>
            <line x1="12" y1="12" x2="12" y2="16"/>
          </svg>
          <div class="picker-card-info">
            <span class="picker-card-name">{{ wf.name }}</span>
            <span v-if="wf.updatedAt" class="picker-card-date">{{ formatDate(wf.updatedAt) }}</span>
          </div>
        </div>

        <div v-if="availableWorkflows.length === 0" class="picker-empty">
          <p class="picker-empty-text">No workflows saved yet</p>
        </div>
      </div>

      <!-- Node palette (shown when a tab is active and picker is closed) -->
      <WorkflowNodePalette
        v-else-if="activeTabId"
        :is-dark="isDark"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import WorkflowNodePalette from './workflow/WorkflowNodePalette.vue';
import { ipcRenderer } from 'electron';
import type { WorkflowListItem } from './workflow/types';

const props = defineProps<{
  isDark: boolean;
}>();

const emit = defineEmits<{
  'close': [];
  'workflow-activated': [workflowId: string];
  'workflow-closed': [workflowId: string];
  'workflow-created': [workflowId: string, workflowName: string];
}>();

interface OpenTab {
  id: string;
  name: string;
}

const openTabs = ref<OpenTab[]>([]);
const activeTabId = ref<string | null>(null);
const showingPicker = ref(false);
const availableWorkflows = ref<WorkflowListItem[]>([]);
let nextNewId = 1;

onMounted(async() => {
  await loadWorkflowList();
});

async function loadWorkflowList() {
  try {
    availableWorkflows.value = await ipcRenderer.invoke('workflow-list');
  } catch {
    availableWorkflows.value = [];
  }
}

function activateTab(id: string) {
  activeTabId.value = id;
  showingPicker.value = false;
  emit('workflow-activated', id);
}

function closeTab(id: string) {
  const idx = openTabs.value.findIndex(t => t.id === id);
  if (idx === -1) return;

  openTabs.value.splice(idx, 1);
  emit('workflow-closed', id);

  if (activeTabId.value === id) {
    if (openTabs.value.length > 0) {
      const newActive = openTabs.value[Math.min(idx, openTabs.value.length - 1)];
      activateTab(newActive.id);
    } else {
      activeTabId.value = null;
    }
  }
}

function togglePicker() {
  showingPicker.value = !showingPicker.value;
  if (showingPicker.value) {
    loadWorkflowList();
  }
}

function openWorkflow(id: string, name: string) {
  // Don't open duplicate tabs
  const existing = openTabs.value.find(t => t.id === id);
  if (existing) {
    activateTab(existing.id);
    return;
  }

  openTabs.value.push({ id, name });
  activateTab(id);
}

async function createNewWorkflow() {
  const id = `workflow-${ Date.now() }`;
  const name = `Workflow ${ nextNewId++ }`;

  emit('workflow-created', id, name);
  openTabs.value.push({ id, name });
  activateTab(id);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}
</script>

<style scoped>
.workflow-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
  color: #333;
  font-size: 13px;
  user-select: none;
  overflow: hidden;
}

.workflow-pane.dark {
  background: #1e293b;
  color: #ccc;
}

/* ── Tab bar ── */
.workflow-tab-bar {
  display: flex;
  align-items: center;
  height: 35px;
  flex-shrink: 0;
  background: #f8fafc;
  border-bottom: 1px solid #cbd5e1;
  padding: 0 2px;
  gap: 1px;
}

.workflow-tab-bar.dark {
  background: #1e293b;
  border-bottom-color: #3c3c3c;
}

.workflow-tabs-scroll {
  display: flex;
  align-items: center;
  flex: 1;
  overflow-x: auto;
  gap: 1px;
  min-width: 0;
}

.workflow-tabs-scroll::-webkit-scrollbar {
  display: none;
}

.workflow-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.workflow-tab:hover {
  background: rgba(0, 0, 0, 0.04);
}

.workflow-tab.active {
  background: rgba(99, 102, 241, 0.1);
}

.workflow-tab.dark:hover {
  background: rgba(255, 255, 255, 0.06);
}

.workflow-tab.dark.active {
  background: rgba(99, 102, 241, 0.15);
}

.workflow-tab-name {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workflow-tab.active .workflow-tab-name {
  color: #6366f1;
}

.workflow-tab.dark .workflow-tab-name {
  color: #94a3b8;
}

.workflow-tab.dark.active .workflow-tab-name {
  color: #818cf8;
}

.workflow-tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 3px;
  cursor: pointer;
  padding: 0;
  opacity: 0;
}

.workflow-tab:hover .workflow-tab-close {
  opacity: 1;
}

.workflow-tab-close:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #475569;
}

.workflow-tab-close.dark:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.workflow-tab-add,
.workflow-pane-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
}

.workflow-tab-add:hover,
.workflow-pane-close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #475569;
}

.workflow-tab-add.active {
  color: #6366f1;
}

.workflow-tab-add.dark,
.workflow-pane-close.dark {
  color: #64748b;
}

.workflow-tab-add.dark:hover,
.workflow-pane-close.dark:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
}

.workflow-tab-add.dark.active {
  color: #818cf8;
}

/* ── Content ── */
.workflow-pane-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* ── Picker ── */
.workflow-picker {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.picker-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  color: #475569;
}

.picker-card:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.picker-card.dark {
  background: #2d2d44;
  border-color: #3c3c5c;
  color: #94a3b8;
}

.picker-card.dark:hover {
  border-color: #4a4a6a;
  background: #33334e;
}

.picker-card-create {
  border-style: dashed;
  color: #6366f1;
}

.picker-card-create.dark {
  color: #818cf8;
}

.picker-card-text {
  font-size: 13px;
  font-weight: 500;
}

.picker-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.picker-card-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-card.dark .picker-card-name {
  color: #e2e8f0;
}

.picker-card-date {
  font-size: 11px;
  color: #94a3b8;
}

.picker-card.dark .picker-card-date {
  color: #64748b;
}

.picker-empty {
  padding: 24px 16px;
  text-align: center;
}

.picker-empty-text {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}
</style>

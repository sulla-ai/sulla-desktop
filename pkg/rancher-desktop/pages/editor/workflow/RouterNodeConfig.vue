<template>
  <div class="router-config" :class="{ dark: isDark }">
    <div class="node-field">
      <label class="node-field-label" :class="{ dark: isDark }">Classification Prompt</label>
      <textarea
        class="node-field-input node-field-textarea"
        :class="{ dark: isDark }"
        rows="3"
        placeholder="Describe how to classify incoming messages into routes..."
        :value="config.classificationPrompt || ''"
        @input="onPromptChange"
      ></textarea>
    </div>

    <div class="node-field">
      <label class="node-field-label" :class="{ dark: isDark }">Routes</label>
      <div class="routes-list">
        <div v-for="(route, idx) in config.routes" :key="idx" class="route-row">
          <input
            class="node-field-input route-label-input"
            :class="{ dark: isDark }"
            placeholder="Route label"
            :value="route.label"
            @input="onRouteChange(idx, 'label', ($event.target as HTMLInputElement).value)"
          />
          <button class="route-remove-btn" :class="{ dark: isDark }" @click="removeRoute(idx)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <button class="route-add-btn" :class="{ dark: isDark }" @click="addRoute">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Route
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RouterNodeConfig } from './types';

const props = defineProps<{
  isDark: boolean;
  nodeId: string;
  config: RouterNodeConfig;
}>();

const emit = defineEmits<{
  'update-config': [nodeId: string, config: RouterNodeConfig];
}>();

function onPromptChange(event: Event) {
  const el = event.target as HTMLTextAreaElement;

  emit('update-config', props.nodeId, {
    ...props.config,
    classificationPrompt: el.value,
  });
}

function onRouteChange(idx: number, field: 'label' | 'description', value: string) {
  const routes = [...props.config.routes];
  routes[idx] = { ...routes[idx], [field]: value };
  emit('update-config', props.nodeId, { ...props.config, routes });
}

function addRoute() {
  const routes = [...props.config.routes, { label: '', description: '' }];
  emit('update-config', props.nodeId, { ...props.config, routes });
}

function removeRoute(idx: number) {
  const routes = props.config.routes.filter((_, i) => i !== idx);
  emit('update-config', props.nodeId, { ...props.config, routes });
}
</script>

<style scoped>
.router-config { padding: 0; }

.node-field {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
}
.router-config.dark .node-field { border-bottom-color: #3c3c5c; }

.node-field-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  margin-bottom: 6px;
}
.node-field-label.dark { color: #94a3b8; }

.node-field-input {
  width: 100%;
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #fff;
  color: #1e293b;
  outline: none;
  box-sizing: border-box;
}
.node-field-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}
.node-field-input.dark {
  background: #2d2d44;
  border-color: #3c3c5c;
  color: #e2e8f0;
}
.node-field-input.dark:focus { border-color: #6366f1; }

.node-field-textarea {
  resize: vertical;
  font-family: inherit;
  min-height: 60px;
}

.routes-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.route-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.route-label-input { flex: 1; }

.route-remove-btn {
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
.route-remove-btn:hover { background: rgba(0,0,0,0.06); color: #ef4444; }
.route-remove-btn.dark:hover { background: rgba(255,255,255,0.08); color: #f87171; }

.route-add-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border: 1px dashed #e2e8f0;
  border-radius: 4px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  margin-top: 4px;
}
.route-add-btn:hover { border-color: #6366f1; color: #6366f1; }
.route-add-btn.dark { border-color: #3c3c5c; color: #94a3b8; }
.route-add-btn.dark:hover { border-color: #6366f1; color: #818cf8; }
</style>

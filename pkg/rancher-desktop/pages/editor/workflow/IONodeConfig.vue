<template>
  <div class="io-config" :class="{ dark: isDark }">
    <!-- User Input -->
    <template v-if="subtype === 'user-input'">
      <div class="node-field">
        <label class="node-field-label" :class="{ dark: isDark }">Prompt Text</label>
        <textarea
          class="node-field-input node-field-textarea"
          :class="{ dark: isDark }"
          rows="3"
          placeholder="Message shown to the user when asking for input..."
          :value="config.promptText || ''"
          @input="updateField('promptText', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>
    </template>

    <!-- Transfer -->
    <template v-else-if="subtype === 'transfer'">
      <div class="node-field">
        <label class="node-field-label" :class="{ dark: isDark }">Target Workflow</label>
        <select
          class="node-field-input"
          :class="{ dark: isDark }"
          :value="config.targetWorkflowId || ''"
          @change="updateField('targetWorkflowId', ($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">-- Select Workflow --</option>
          <option v-for="wf in workflows" :key="wf.id" :value="wf.id">{{ wf.name }}</option>
        </select>
      </div>
    </template>

    <!-- Response — no extra config for now -->
    <template v-else-if="subtype === 'response'">
      <div class="node-field">
        <p class="config-hint" :class="{ dark: isDark }">
          This node sends a response back to the user. Configure the label to describe the response.
        </p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ipcRenderer } from 'electron';
import type { IONodeSubtype } from './types';

const props = defineProps<{
  isDark: boolean;
  nodeId: string;
  subtype: IONodeSubtype;
  config: Record<string, any>;
}>();

const emit = defineEmits<{
  'update-config': [nodeId: string, config: Record<string, any>];
}>();

const workflows = ref<{ id: string; name: string }[]>([]);

onMounted(async() => {
  if (props.subtype === 'transfer') {
    try {
      workflows.value = await ipcRenderer.invoke('workflow-list');
    } catch {
      workflows.value = [];
    }
  }
});

function updateField(field: string, value: any) {
  emit('update-config', props.nodeId, { ...props.config, [field]: value });
}
</script>

<style scoped>
.io-config { padding: 0; }

.node-field {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
}
.io-config.dark .node-field { border-bottom-color: #3c3c5c; }

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

.config-hint {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.4;
}
.config-hint.dark { color: #64748b; }
</style>

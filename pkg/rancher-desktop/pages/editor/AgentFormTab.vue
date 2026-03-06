<template>
  <div class="agent-form" :class="{ dark: isDark }">
    <div class="form-inner">
      <h2 class="form-title">{{ isEditMode ? 'Edit Agent' : 'Create New Agent' }}</h2>

      <label class="form-label">Agent ID <span class="required">*</span></label>
      <input
        v-model="form.id"
        class="form-input"
        :class="{ dark: isDark, error: errors.id, disabled: isEditMode }"
        :disabled="isEditMode"
        placeholder="my-agent-name"
        @input="enforceSlug"
      />
      <p v-if="!isEditMode" class="form-hint">Lowercase letters, numbers, and hyphens only. Becomes the folder name.</p>
      <p v-if="errors.id" class="form-error">{{ errors.id }}</p>

      <label class="form-label">Agent Name <span class="required">*</span></label>
      <input
        v-model="form.name"
        class="form-input"
        :class="{ dark: isDark, error: errors.name }"
        placeholder="My Agent"
      />
      <p v-if="errors.name" class="form-error">{{ errors.name }}</p>

      <label class="form-label">Description</label>
      <textarea
        v-model="form.description"
        class="form-textarea"
        :class="{ dark: isDark }"
        placeholder="What does this agent do?"
        rows="3"
      ></textarea>

      <label class="form-label">Type <span class="required">*</span></label>
      <select v-model="form.type" class="form-select" :class="{ dark: isDark }">
        <option value="planner">Planner</option>
        <option value="worker">Worker</option>
        <option value="judge">Judge</option>
      </select>

      <label class="form-label">Template</label>
      <select v-model="form.templateId" class="form-select" :class="{ dark: isDark }">
        <option value="glass-core">Glass Core</option>
        <option value="terminal">Terminal</option>
        <option value="industrial">Industrial</option>
        <option value="biosynthetic">Biosynthetic</option>
      </select>

      <hr class="form-separator" :class="{ dark: isDark }" />

      <h3 class="form-section-title">Skills</h3>
      <p v-if="skillsLoading" class="form-hint">Loading skills...</p>
      <p v-else-if="skillsFolders.length === 0" class="form-hint">No skills folders found.</p>
      <div v-else class="skills-list">
        <label
          v-for="skill in skillsFolders"
          :key="skill"
          class="skill-checkbox"
          :class="{ dark: isDark }"
        >
          <input
            type="checkbox"
            :value="skill"
            v-model="form.skills"
            @change="emit('dirty')"
          />
          <span class="skill-name">{{ skill }}</span>
        </label>
      </div>

      <div class="form-actions">
        <button class="save-btn" :class="{ dark: isDark }" :disabled="saving" @click="save">
          {{ saving ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Agent') }}
        </button>
      </div>

      <p v-if="saveError" class="form-error save-error">{{ saveError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue';
import { ipcRenderer } from 'electron';
import yaml from 'yaml';

const props = defineProps<{
  isDark: boolean;
  content?: string;
  filePath?: string;
  fileExt?: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  'dirty': [];
  'saved': [agentPath: string];
}>();

const isEditMode = computed(() => {
  return !!props.filePath && props.filePath.startsWith('agent-form://edit/');
});

const form = reactive({
  id: '',
  name: '',
  description: '',
  type: 'worker',
  templateId: 'glass-core',
  skills: [] as string[],
});

const errors = reactive({ id: '', name: '' });
const saving = ref(false);
const saveError = ref('');
const skillsFolders = ref<string[]>([]);
const skillsLoading = ref(false);

onMounted(async() => {
  // If content is provided (edit mode), parse YAML to pre-fill form
  if (props.content) {
    try {
      const parsed = yaml.parse(props.content);
      if (parsed) {
        form.name = parsed.name || '';
        form.description = parsed.description || '';
        form.type = parsed.type || 'worker';
        form.templateId = parsed.templateId || 'glass-core';
        form.skills = Array.isArray(parsed.skills) ? parsed.skills : [];
      }
    } catch { /* ignore parse errors */ }
  }
  // Extract agent ID from filePath: agent-form://edit/{agentId}
  if (isEditMode.value && props.filePath) {
    form.id = props.filePath.replace('agent-form://edit/', '');
  }

  // Load skills folders
  await loadSkillsFolders();
});

async function loadSkillsFolders() {
  skillsLoading.value = true;
  try {
    const vars: { key: string; preview: string }[] = await ipcRenderer.invoke('agents-get-template-variables');
    const skillsDirVar = vars.find(v => v.key === '{{skills_dir}}');
    if (!skillsDirVar) return;

    const entries: { name: string; isDir: boolean }[] = await ipcRenderer.invoke('filesystem-read-dir', skillsDirVar.preview);
    skillsFolders.value = entries.filter(e => e.isDir).map(e => e.name);
  } catch (err) {
    console.error('Failed to load skills folders:', err);
  } finally {
    skillsLoading.value = false;
  }
}

function enforceSlug() {
  form.id = form.id
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-/, '');
  emit('dirty');
}

function validate(): boolean {
  errors.id = '';
  errors.name = '';

  if (!form.id.trim()) {
    errors.id = 'Agent ID is required';
  } else if (!/^[a-z0-9][a-z0-9-]*$/.test(form.id)) {
    errors.id = 'Must start with a letter or number';
  }
  if (!form.name.trim()) {
    errors.name = 'Agent name is required';
  }

  return !errors.id && !errors.name;
}

async function save() {
  if (!validate()) return;

  saving.value = true;
  saveError.value = '';

  try {
    const root = await ipcRenderer.invoke('filesystem-get-root');
    const agentsDir = `${root}/agents`;
    const agentDir = `${agentsDir}/${form.id}`;

    if (!isEditMode.value) {
      // Create the agent directory
      await ipcRenderer.invoke('filesystem-create-dir', agentsDir, form.id);
    }

    // Build and write agent.yaml
    const agentYaml = yaml.stringify({
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      templateId: form.templateId,
      skills: form.skills,
    });

    await ipcRenderer.invoke('filesystem-write-file', `${agentDir}/agent.yaml`, agentYaml);

    if (!isEditMode.value) {
      // Create soul.md and environment.md from prompt templates (only on new agent)
      const templates = await ipcRenderer.invoke('agents-get-prompt-templates');
      await Promise.all([
        ipcRenderer.invoke('filesystem-write-file', `${agentDir}/soul.md`, templates.soul),
        ipcRenderer.invoke('filesystem-write-file', `${agentDir}/environment.md`, templates.environment),
      ]);
    }

    emit('saved', agentDir);
  } catch (err: any) {
    saveError.value = err?.message || 'Failed to save agent';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.agent-form {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: #ffffff;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.agent-form.dark {
  background: #0f172a;
  color: #e2e8f0;
}

.form-inner {
  max-width: 520px;
  margin: 0 auto;
  padding: 32px 24px;
}

.form-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 24px 0;
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #64748b;
  margin: 16px 0 6px 0;
}

.agent-form.dark .form-label {
  color: #94a3b8;
}

.required {
  color: #ef4444;
}

.form-input,
.form-textarea,
.form-select {
  display: block;
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #333;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  border-color: #0078d4;
  box-shadow: 0 0 0 2px rgba(0,120,212,0.15);
}

.form-input.dark,
.form-textarea.dark,
.form-select.dark {
  background: #1e293b;
  border-color: #334155;
  color: #e2e8f0;
}

.form-input.error {
  border-color: #ef4444;
}

.form-input.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-textarea {
  resize: vertical;
  min-height: 60px;
}

.form-select {
  cursor: pointer;
}

.form-hint {
  font-size: 11px;
  color: #94a3b8;
  margin: 4px 0 0 0;
}

.form-error {
  font-size: 12px;
  color: #ef4444;
  margin: 4px 0 0 0;
}

.save-error {
  margin-top: 12px;
}

.form-actions {
  margin-top: 24px;
}

.save-btn {
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  background: #0078d4;
  color: #fff;
  cursor: pointer;
}

.save-btn:hover {
  background: #006abc;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-btn.dark {
  background: #0078d4;
}

.save-btn.dark:hover {
  background: #1a8ae8;
}

.form-separator {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 24px 0 16px 0;
}

.form-separator.dark {
  border-top-color: #334155;
}

.form-section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
}

.skills-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.skill-checkbox:hover {
  background: rgba(0,0,0,0.04);
}

.skill-checkbox.dark:hover {
  background: rgba(255,255,255,0.04);
}

.skill-checkbox input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}

.skill-name {
  user-select: none;
}
</style>

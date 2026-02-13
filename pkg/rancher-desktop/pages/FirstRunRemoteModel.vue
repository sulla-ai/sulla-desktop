<template>
  <div class="max-w-lg mx-auto p-6 bg-white dark:bg-gray-800">
    <form @submit.prevent="handleNext">
      <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Remote Model (Optional)</h2>
      <p class="mb-6 text-gray-600 dark:text-gray-400">
        Optionally enable a remote model. While your system will be fully configured to run a local model, at times that can be very slow, and many people prefer to run a remote model for better performance. You can toggle between local and remote models at any time.
      </p>

      <rd-fieldset legend-text="Remote Model Configuration" class="mb-6">
        <div class="mb-4">
          <label for="provider" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provider:</label>
          <select id="provider" v-model="selectedProvider" @change="onProviderChange" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <option v-for="provider in providers" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
          </select>
        </div>
        <div class="mb-4">
          <label for="model" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model:</label>
          <select id="model" v-model="selectedModel" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <option v-for="model in currentModels" :key="model.id" :value="model.id">{{ model.name }} - {{ model.description }}{{ model.pricing ? ` (${model.pricing})` : '' }}</option>
          </select>
        </div>
        <div class="mb-4">
          <label for="apiKey" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key:</label>
          <input id="apiKey" type="password" v-model="apiKey" placeholder="Enter your API key" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
        </div>
        <div class="flex gap-2">
          <button type="button" @click="testCredentials" :disabled="testing" class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50">
            {{ testing ? 'Testing...' : 'Test Credentials' }}
          </button>
          <span v-if="testResult" class="text-sm" :class="testResult.success ? 'text-green-600' : 'text-red-600'">{{ testResult.message }}</span>
        </div>
      </rd-fieldset>

      <div class="flex justify-between">
        <button type="button" @click="$emit('back')" class="px-6 py-2 text-gray-500 rounded-md hover:bg-gray-200 cursor-pointer">Back</button>
        <button type="submit" class="px-6 py-2 text-white rounded-md hover:opacity-90" :style="{ backgroundColor: '#30a5e9' }">Next</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, computed } from 'vue';
import { Ref } from 'vue';
import { RecursivePartial } from '@pkg/utils/typeUtils';
import { Settings } from '@pkg/config/settings';
import RdFieldset from '@pkg/components/form/RdFieldset.vue';
import { ipcRenderer } from 'electron';
import { REMOTE_PROVIDERS } from '../shared/remoteProviders';

interface Model {
  id: string;
  name: string;
  description: string;
  pricing?: string;
}

const settings = inject<Ref<Settings>>('settings')!;
const commitChanges = inject<(settings: RecursivePartial<Settings>) => Promise<void>>('commitChanges')!;
const emit = defineEmits<{
  next: [];
  back: [];
}>();

const selectedProvider = ref('grok');
const selectedModel = ref('grok-4-1-fast-reasoning');
const apiKey = ref('');
const testing = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

const providers = REMOTE_PROVIDERS;

const models = Object.fromEntries(REMOTE_PROVIDERS.map(provider => [provider.id, provider.models]));

const currentModels = computed(() => models[selectedProvider.value as keyof typeof models] || []);

const onProviderChange = () => {
  const providerModels = currentModels.value;
  if (providerModels.length > 0) {
    selectedModel.value = providerModels[0].id;
  }
};

const testCredentials = async () => {
  if (!apiKey.value.trim()) {
    testResult.value = { success: false, message: 'Please enter an API key.' };
    return;
  }

  testing.value = true;
  testResult.value = null;

  try {
    const provider = providers.find(p => p.id === selectedProvider.value);
    if (!provider) {
      testResult.value = { success: false, message: 'Invalid provider selected.' };
      return;
    }

    const timeoutMs = 10000; // 10 seconds

    if (selectedProvider.value === 'grok' || selectedProvider.value === 'openai' || selectedProvider.value === 'kimi' || selectedProvider.value === 'nvidia') {
      const testUrl = `${provider.baseUrl}/chat/completions`;
      const testBody = {
        model: selectedModel.value,
        messages: [{ role: 'user', content: 'Reply with the word: OK' }],
        temperature: 0,
        max_tokens: 10,
      };

      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.value}`,
        },
        body: JSON.stringify(testBody),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        testResult.value = { success: false, message: `Test failed: ${response.status}. Check model, key, and network.` };
      } else {
        testResult.value = { success: true, message: 'Credentials are valid!' };
      }
    } else {
      testResult.value = { success: false, message: 'Credential test not supported for this provider yet.' };
    }
  } catch (error) {
    testResult.value = { success: false, message: 'Test failed. Check your connection and credentials.' };
  } finally {
    testing.value = false;
  }
};

const handleNext = async () => {
  // Save settings if API key is provided
  if (apiKey.value.trim()) {
    await commitChanges({
      experimental: {
        remoteProvider: selectedProvider.value,
        remoteModel: selectedModel.value,
        remoteApiKey: apiKey.value,
        modelMode: 'remote',
      },
    });
  }

  emit('next');
};

// Load existing settings
onMounted(() => {
  ipcRenderer.invoke('settings-read' as any).then((loadedSettings: Settings) => {
    settings.value = loadedSettings;
    if (settings.value.experimental.remoteProvider) {
      selectedProvider.value = settings.value.experimental.remoteProvider;
    }
    if (settings.value.experimental.remoteModel) {
      selectedModel.value = settings.value.experimental.remoteModel;
    }
    if (settings.value.experimental.remoteApiKey) {
      apiKey.value = settings.value.experimental.remoteApiKey;
    }
  });
});
</script>

<style lang="scss" scoped>
/* Hover effects */
button:hover {
  cursor: pointer;
}

input:hover, select:hover {
  border-color: #374151; /* darker gray border */
  background-color: #f3f4f6; /* slightly darker background */
}
</style>

<template>
  <div class="max-w-lg mx-auto p-6 bg-white dark:bg-gray-800">
    <form @submit.prevent="handleNext">
      <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Remote Model (Optional)</h2>
      <p class="mb-6 text-gray-600 dark:text-gray-400">
        Optionally enable a remote model. While your system will be fully configured to run a local model, at times that can be very slow, and many people prefer to run a remote model for better performance. You can toggle between local and remote models at any time.
      </p>

      <rd-fieldset legend-text="Remote Model Configuration" class="mb-6">
        <!-- Error display -->
        <div v-if="error" class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {{ error }}
        </div>
        
        <div class="mb-4">
          <label for="provider" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provider:</label>
          <select 
            id="provider" 
            v-model="selectedProvider" 
            @change="onProviderChange" 
            :disabled="loadingProviders"
            class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          >
            <option v-if="loadingProviders" value="">Loading providers...</option>
            <option v-else-if="providers.length === 0" value="">No providers available</option>
            <option v-else v-for="provider in providers" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
          </select>
        </div>
        
        <div class="mb-4">
          <label for="model" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model:</label>
          <div class="flex gap-2">
            <select 
              id="model" 
              v-model="selectedModel" 
              :disabled="loadingModels || currentModels.length === 0"
              class="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
            >
              <option v-if="loadingModels" value="">Loading models...</option>
              <option v-else-if="!apiKey.trim()" value="">Enter API key to load models</option>
              <option v-else-if="currentModels.length === 0" value="">No models available</option>
              <option v-else v-for="model in currentModels" :key="model.id" :value="model.id">
                {{ model.name }} - {{ model.description }}{{ model.pricing ? ` (${model.pricing})` : '' }}
              </option>
            </select>
            <button 
              type="button" 
              @click="refreshModels" 
              :disabled="loadingModels || !apiKey.trim()" 
              class="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh models"
            >
              🔄
            </button>
          </div>
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
import { ref, inject, onMounted, computed, watch } from 'vue';
import { Ref } from 'vue';
import { RecursivePartial } from '@pkg/utils/typeUtils';
import { Settings } from '@pkg/config/settings';
import RdFieldset from '@pkg/components/form/RdFieldset.vue';
import { ipcRenderer } from 'electron';
import { getSupportedProviders, fetchModelsForProvider, clearModelCache } from '../agent/languagemodels';

interface Model {
  id: string;
  name: string;
  description: string;
  pricing?: string;
}

interface Provider {
  id: string;
  name: string;
}

const settings = inject<Ref<Settings>>('settings')!;
const commitChanges = inject<(settings: RecursivePartial<Settings>) => Promise<void>>('commitChanges')!;
const emit = defineEmits<{
  next: [];
  back: [];
}>();

const selectedProvider = ref('openai');
const selectedModel = ref('');
const apiKey = ref('');
const testing = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

// Dynamic provider and model data
const providers = ref<Provider[]>([]);
const models = ref<Record<string, Model[]>>({});
const loadingProviders = ref(false);
const loadingModels = ref(false);
const error = ref<string | null>(null);

const currentModels = computed(() => models.value[selectedProvider.value] || []);

// Load supported providers dynamically
const loadProviders = async () => {
  try {
    loadingProviders.value = true;
    error.value = null;
    
    const supportedProviders = getSupportedProviders();
    providers.value = supportedProviders.map(id => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1) // Capitalize provider name
    }));
    
    // Set default provider if available
    if (providers.value.length > 0 && !selectedProvider.value) {
      selectedProvider.value = providers.value[0].id;
    }
  } catch (err) {
    error.value = `Failed to load providers: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[FirstRun] Error loading providers:', err);
  } finally {
    loadingProviders.value = false;
  }
};

// Load models for a specific provider
const loadModelsForProvider = async (providerId: string, apiKey: string) => {
  try {
    loadingModels.value = true;
    error.value = null;
    
    const modelList = await fetchModelsForProvider(providerId, apiKey);
    
    // Transform ModelInfo to our Model interface
    const transformedModels: Model[] = modelList.map(modelInfo => ({
      id: modelInfo.id,
      name: modelInfo.name,
      description: modelInfo.description || `${modelInfo.name} model`,
      pricing: modelInfo.pricing ? 
        `Input: $${modelInfo.pricing.input || 0}/1M tokens, Output: $${modelInfo.pricing.output || 0}/1M tokens` : 
        undefined
    }));
    
    models.value[providerId] = transformedModels;
    
    // Auto-select first model if none selected
    if (transformedModels.length > 0 && (!selectedModel.value || !transformedModels.find(m => m.id === selectedModel.value))) {
      selectedModel.value = transformedModels[0].id;
    }
  } catch (err) {
    error.value = `Failed to load models for ${providerId}: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[FirstRun] Error loading models:', err);
    models.value[providerId] = [];
  } finally {
    loadingModels.value = false;
  }
};

const onProviderChange = async () => {
  // Clear current model selection
  selectedModel.value = '';
  
  // If we have an API key, try to load models immediately
  if (apiKey.value.trim()) {
    await loadModelsForProvider(selectedProvider.value, apiKey.value);
  } else {
    // Clear models for this provider if no API key
    models.value[selectedProvider.value] = [];
  }
};

// Watch API key changes to reload models
watch([apiKey, selectedProvider], async ([newApiKey, newProvider]) => {
  if (newApiKey && newApiKey.trim() && newProvider) {
    await loadModelsForProvider(newProvider, newApiKey);
  }
});

const testCredentials = async () => {
  if (!apiKey.value.trim()) {
    testResult.value = { success: false, message: 'Please enter an API key.' };
    return;
  }

  if (!selectedModel.value) {
    testResult.value = { success: false, message: 'Please select a model first.' };
    return;
  }

  testing.value = true;
  testResult.value = null;

  try {
    // Test credentials by trying to fetch models (this validates API key)
    await loadModelsForProvider(selectedProvider.value, apiKey.value);
    
    // If model fetching succeeded and we have models, credentials are valid
    const providerModels = models.value[selectedProvider.value];
    if (providerModels && providerModels.length > 0) {
      testResult.value = { success: true, message: `Credentials are valid! Found ${providerModels.length} models.` };
    } else {
      testResult.value = { success: false, message: 'Valid credentials but no models available.' };
    }
  } catch (error) {
    testResult.value = { success: false, message: 'Test failed. Check your API key and connection.' };
    console.error('[FirstRun] Credential test failed:', error);
  } finally {
    testing.value = false;
  }
};

const refreshModels = async () => {
  if (!selectedProvider.value || !apiKey.value.trim()) {
    return;
  }

  try {
    // Clear the cache for this provider
    clearModelCache(selectedProvider.value);
    
    // Clear current models and reload
    models.value[selectedProvider.value] = [];
    selectedModel.value = '';
    
    // Force reload models from API
    await loadModelsForProvider(selectedProvider.value, apiKey.value);
  } catch (error) {
    error.value = `Failed to refresh models: ${error instanceof Error ? error.message : String(error)}`;
    console.error('[FirstRun] Model refresh failed:', error);
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

// Load existing settings and initialize dynamic data
onMounted(async () => {
  try {
    // Load supported providers first
    await loadProviders();
    
    // Load existing settings
    const loadedSettings: Settings = await ipcRenderer.invoke('settings-read' as any);
    settings.value = loadedSettings;
    
    // Apply existing settings if they exist
    if (settings.value.experimental.remoteProvider) {
      selectedProvider.value = settings.value.experimental.remoteProvider;
    }
    if (settings.value.experimental.remoteModel) {
      selectedModel.value = settings.value.experimental.remoteModel;
    }
    if (settings.value.experimental.remoteApiKey) {
      apiKey.value = settings.value.experimental.remoteApiKey;
    }
    
    // Load models for the selected provider if we have an API key
    if (selectedProvider.value && apiKey.value.trim()) {
      await loadModelsForProvider(selectedProvider.value, apiKey.value);
    }
  } catch (err) {
    error.value = `Failed to initialize: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[FirstRun] Initialization error:', err);
  }
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

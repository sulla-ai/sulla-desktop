<template>
  <div class="min-h-screen bg-white text-[#0d0d0d] dark:bg-neutral-950 dark:text-neutral-50 font-sans relative" :class="{ dark: isDark }">
    <div
      class="absolute top-4 left-4 z-40 text-sm font-semibold tracking-tight text-[#0d0d0d]/80 dark:text-white/80"
    >
      Sulla Desktop by Jonathon Byrdziak
    </div>

    <div class="absolute top-4 right-4 z-40 flex items-center gap-2">
      <a
        class="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[#0d0d0d] shadow-sm backdrop-blur hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:hover:bg-neutral-950/90"
        href="https://github.com/sulla-ai/desktop"
        target="_blank"
        rel="noreferrer"
        aria-label="Open GitHub repository"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
          <path d="M12 .5C5.73.5.75 5.66.75 12.02c0 5.12 3.29 9.46 7.86 10.99.58.11.79-.26.79-.57 0-.28-.01-1.02-.02-2-3.2.7-3.87-1.57-3.87-1.57-.53-1.36-1.29-1.72-1.29-1.72-1.05-.73.08-.72.08-.72 1.16.08 1.77 1.22 1.77 1.22 1.03 1.8 2.69 1.28 3.35.98.1-.77.4-1.28.72-1.57-2.55-.3-5.23-1.31-5.23-5.83 0-1.29.45-2.35 1.19-3.18-.12-.3-.52-1.52.11-3.17 0 0 .97-.32 3.18 1.21.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.2-1.53 3.17-1.21 3.17-1.21.63 1.65.23 2.87.12 3.17.74.83 1.19 1.89 1.19 3.18 0 4.53-2.69 5.53-5.25 5.82.41.36.78 1.08.78 2.19 0 1.58-.02 2.86-.02 3.25 0 .31.21.68.8.56 4.56-1.53 7.84-5.87 7.84-10.98C23.25 5.66 18.27.5 12 .5z" />
        </svg>
      </a>

      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[#0d0d0d] shadow-sm backdrop-blur hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:hover:bg-neutral-950/90"
        :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleTheme"
      >
        <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
        </svg>
      </button>
    </div>

    <!-- Loading overlay while system boots -->
    <div
      v-if="!systemReady"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div class="w-full max-w-lg rounded-2xl border border-black/10 bg-white/85 p-6 shadow-2xl dark:border-white/10 dark:bg-neutral-900/70">
        <div class="text-4xl leading-none mb-3">
          ⚙️
        </div>
        <h2 class="text-xl font-semibold tracking-tight">Starting Sulla...</h2>
        <p class="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          {{ progressDescription || 'Initializing system...' }}
        </p>
        
        <!-- Model download progress -->
        <div
          v-if="modelDownloading"
          class="mt-4 rounded-xl border border-black/10 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5"
        >
          <p class="text-sm text-neutral-800 dark:text-neutral-200">
            📦 Downloading: <strong>{{ modelName }}</strong>
          </p>
          <p class="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {{ modelDownloadStatus }}
          </p>
          <div
            v-if="modelDownloadTotal > 0"
            class="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
          >
            <div
              class="h-full rounded-full bg-gradient-to-r from-indigo-500/90 to-violet-500/90"
              :style="{ width: (modelDownloadProgress / modelDownloadTotal * 100) + '%' }"
            />
          </div>
          <p
            v-if="modelDownloadTotal > 0"
            class="mt-2 font-mono text-[11px] text-neutral-600 dark:text-neutral-400"
          >
            {{ Math.round(modelDownloadProgress / 1024 / 1024) }} MB / {{ Math.round(modelDownloadTotal / 1024 / 1024) }} MB
            ({{ Math.round(modelDownloadProgress / modelDownloadTotal * 100) }}%)
          </p>
        </div>
        
        <!-- K8s progress bar -->
        <div
          v-else-if="progressMax > 0"
          class="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
        >
          <div
            class="h-full rounded-full bg-black/30 dark:bg-white/30"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
        <div
          v-else
          class="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
        >
          <div class="h-full w-1/3 animate-pulse rounded-full bg-black/25 dark:bg-white/25" />
        </div>
      </div>
    </div>

    <!-- Main agent interface -->
    <div
      class="flex min-h-screen flex-col"
      :class="{ 'blur-sm pointer-events-none select-none': !systemReady }"
    >
      <div
        v-if="hasMessages"
        ref="transcriptEl"
        class="flex-1 overflow-y-auto px-4 py-6"
      >
        <div
          v-for="m in messages"
          :key="m.id"
          class="mb-3 flex"
          :class="m.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[min(760px,92%)] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 border"
            :class="m.role === 'user'
              ? 'bg-black/5 border-black/10 text-[#0d0d0d] dark:bg-white/10 dark:border-white/10 dark:text-neutral-50'
              : 'bg-black/3 border-black/10 text-neutral-900 dark:bg-white/5 dark:border-white/10 dark:text-neutral-100'"
          >
            {{ m.content }}
          </div>
        </div>
        <div
          v-if="loading"
          class="mb-3 flex justify-start"
        >
          <div class="max-w-[min(760px,92%)] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 bg-black/3 border border-black/10 text-neutral-900 dark:bg-white/5 dark:border-white/10 dark:text-neutral-100">
            Thinking...
          </div>
        </div>
      </div>

      <div
        :class="hasMessages ? 'sticky bottom-0 border-t border-black/10 bg-white/75 backdrop-blur dark:border-white/10 dark:bg-neutral-950/80' : 'flex flex-1 items-center justify-center bg-white dark:bg-neutral-950'"
      >
        <div class="w-full px-4" :class="hasMessages ? 'py-3' : ''">
          <div
            class="flex h-full flex-col items-center"
            :class="hasMessages ? '' : 'justify-center'"
          >
            <form
              class="group/composer mx-auto mb-3 w-full max-w-3xl"
              :data-empty="!query.trim()"
              :data-running="loading"
              @submit.prevent
            >
              <div class="overflow-hidden rounded-[32px] bg-[#f8f8f8] shadow-sm ring-1 ring-[#e5e5e5] ring-inset transition-shadow focus-within:ring-[#d0d0d0] dark:bg-neutral-900/70 dark:ring-white/10 dark:focus-within:ring-white/20">
                <div class="flex items-end gap-1 p-2">
                  <button
                    type="button"
                    class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0d0d0d] transition-colors hover:bg-[#f0f0f0] disabled:opacity-60 dark:text-white dark:hover:bg-white/10"
                    aria-label="Attach"
                    :disabled="loading || !systemReady"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />
                    </svg>
                  </button>

                  <textarea
                    v-model="query"
                    name="input"
                    placeholder="What do you want to know?"
                    class="my-2 h-6 max-h-[400px] min-w-0 flex-1 resize-none bg-transparent text-[#0d0d0d] text-base leading-6 outline-none placeholder:text-[#9a9a9a] dark:text-white dark:placeholder:text-neutral-500"
                    :disabled="loading || !systemReady"
                    @keydown.enter.exact.prevent="send"
                  />

                  <button
                    type="button"
                    class="mb-0.5 flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-[#0d0d0d] hover:bg-[#f0f0f0] disabled:opacity-60 dark:text-white dark:hover:bg-white/10"
                    aria-label="Model select"
                    :disabled="loading || !systemReady"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
                      <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
                    </svg>
                    <div class="flex items-center gap-1 overflow-hidden">
                      <span class="whitespace-nowrap font-semibold text-sm">Grok 4.1</span>
                      <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0" aria-hidden="true">
                        <path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                      </svg>
                    </div>
                  </button>

                  <div class="relative mb-0.5 h-9 w-9 shrink-0 rounded-full bg-[#0d0d0d] text-white dark:bg-white dark:text-[#0d0d0d]">
                    <button
                      type="button"
                      class="absolute inset-0 flex items-center justify-center"
                      aria-label="Voice mode"
                      :disabled="loading || !systemReady"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M12 19v3" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <rect x="9" y="2" width="6" height="13" rx="3" />
                      </svg>
                    </button>
                  </div>

                  <button
                    type="button"
                    class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0d0d0d] text-white disabled:opacity-60 disabled:cursor-not-allowed dark:bg-white dark:text-[#0d0d0d]"
                    aria-label="Submit"
                    :disabled="loading || !systemReady || !query.trim()"
                    @click="send"
                  >
                    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  getSensory,
  getContextDetector,
  getThread,
  getResponseHandler,
} from '@pkg/agent';
import { updateAgentConfigFull } from '@pkg/agent/services/ConfigService';
import { StartupProgressController } from './agent/StartupProgressController';
import { AgentSettingsController } from './agent/AgentSettingsController';
import { AgentChatController } from './agent/AgentChatController';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);

const currentThreadId = ref<string | null>(null);

// Initialize agent components
const sensory = getSensory();
const contextDetector = getContextDetector();
const responseHandler = getResponseHandler();

const startupState = StartupProgressController.createState();
const {
  systemReady,
  progressCurrent,
  progressMax,
  progressDescription,
  startupPhase,
  modelDownloading,
  modelName,
  modelDownloadProgress,
  modelDownloadTotal,
  modelDownloadStatus,
  modelMode,
  progressPercent,
} = startupState;

// Ollama memory error recovery
const ollamaRestarting = ref(false);
const memoryErrorCount = ref(0);
const MAX_MEMORY_ERROR_RETRIES = 3;

const startupProgress = new StartupProgressController(startupState);

const settingsController = new AgentSettingsController(
  {
    modelName,
    modelMode,
  },
  updateAgentConfigFull,
);

startupProgress.setMemoryErrorRefs({
  ollamaRestarting,
  memoryErrorCount,
  maxRetries: MAX_MEMORY_ERROR_RETRIES,
});

const chatController = new AgentChatController({
  systemReady,
  currentThreadId,
  sensory,
  contextDetector,
  getThread,
  responseHandler,
  startupProgress,
});

const {
  query,
  loading,
  messages,
  transcriptEl,
  hasMessages,
} = chatController;

onMounted(async () => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);

  if (stored === 'dark') {
    isDark.value = true;
  } else if (stored === 'light') {
    isDark.value = false;
  } else {
    isDark.value = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  startupProgress.start();

  settingsController.start();

  await startupProgress.initializeFromBackend();
});

onUnmounted(() => {
  startupProgress.dispose();
  settingsController.dispose();
});

const send = () => chatController.send();

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
};
</script>


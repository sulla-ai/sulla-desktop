<template>
  <div class="min-h-screen overflow-y-auto bg-white text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans" :class="{ dark: isDark }">
    <div class="flex min-h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex-1 overflow-auto">
        <div class="mx-auto max-w-6xl px-4 py-8">
          <!-- Back button -->
          <button
            @click="$router.push('/Chat')"
            class="mb-6 flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Chat
          </button>

          <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <!-- Main Content -->
            <div class="lg:col-span-2 space-y-8">
              <!-- Header -->
              <div class="flex items-start gap-6">
                <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <img
                    :src="require('@pkg/assets/images/n8n.svg')"
                    alt="N8N"
                    class="h-12 w-12 object-contain"
                  >
                </div>
                <div class="flex-1">
                  <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                    N8N
                  </h1>
                  <p class="text-lg text-slate-600 dark:text-slate-300 mb-4">
                    Powerful workflow automation platform for connecting apps and services
                  </p>
                  <div class="flex items-center gap-4">
                    <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                      Automation
                    </span>
                    <div class="flex items-center gap-2">
                      <div class="h-2 w-2 rounded-full bg-green-500"></div>
                      <span class="text-xs text-slate-500 dark:text-slate-400">
                        Available
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Connect/Open Card -->
              <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-slate-800">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Access N8N Dashboard
                </h3>

                <div class="space-y-4">
                  <button
                    @click="openN8N"
                    class="w-full rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    Open N8N Dashboard
                  </button>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    Opens N8N in your default web browser at localhost:5678
                  </p>
                </div>
              </div>
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-2 space-y-8">
              <!-- Installation Guide -->
              <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-slate-800">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">Getting Started</h3>
                <p class="text-sm text-slate-600 dark:text-slate-300 mb-6">Follow these steps to start using N8N for workflow automation.</p>

                <div class="space-y-6">
                  <div class="border-l-2 border-blue-200 dark:border-blue-800 pl-4">
                    <div class="flex items-center gap-2 mb-2">
                      <div class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-medium">
                        1
                      </div>
                      <h4 class="font-medium text-slate-900 dark:text-white">Install N8N</h4>
                    </div>
                    <div class="prose prose-sm max-w-none dark:prose-invert">
                      <div class="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300 leading-relaxed">N8N is available via Docker Compose. Run the automated setup or manually configure it.</div>
                    </div>
                  </div>

                  <div class="border-l-2 border-blue-200 dark:border-blue-800 pl-4">
                    <div class="flex items-center gap-2 mb-2">
                      <div class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-medium">
                        2
                      </div>
                      <h4 class="font-medium text-slate-900 dark:text-white">Access Dashboard</h4>
                    </div>
                    <div class="prose prose-sm max-w-none dark:prose-invert">
                      <div class="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300 leading-relaxed">Click the "Open N8N Dashboard" button above to access the web interface.</div>
                    </div>
                  </div>

                  <div class="border-l-2 border-blue-200 dark:border-blue-800 pl-4">
                    <div class="flex items-center gap-2 mb-2">
                      <div class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-medium">
                        3
                      </div>
                      <h4 class="font-medium text-slate-900 dark:text-white">Create Workflows</h4>
                    </div>
                    <div class="prose prose-sm max-w-none dark:prose-invert">
                      <div class="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300 leading-relaxed">Start building automated workflows by connecting triggers and actions.</div>
                    </div>
                  </div>
                </div>

                <div class="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h5 class="font-medium text-amber-900 dark:text-amber-100 mb-2">Important Notes</h5>
                  <ul class="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                    <li class="flex items-start gap-2">
                      <svg class="h-4 w-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                      </svg>
                      Ensure Docker is running before starting N8N
                    </li>
                    <li class="flex items-start gap-2">
                      <svg class="h-4 w-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                      </svg>
                      N8N runs on port 5678 by default
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Additional Resources -->
              <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-slate-800">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">Resources</h3>
                <div class="space-y-3">
                  <a
                    href="https://docs.n8n.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-slate-800"
                  >
                    <div class="flex items-center gap-3">
                      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                        <svg class="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 class="font-medium text-slate-900 dark:text-white text-sm">Official Documentation</h4>
                        <p class="text-xs text-slate-600 dark:text-slate-400">Complete guide and API reference</p>
                      </div>
                    </div>
                    <svg class="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  <a
                    href="https://community.n8n.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-slate-800"
                  >
                    <div class="flex items-center gap-3">
                      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                        <svg class="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      </div>
                      <div>
                        <h4 class="font-medium text-slate-900 dark:text-white text-sm">Community Forum</h4>
                        <p class="text-xs text-slate-600 dark:text-slate-400">Get help and share workflows</p>
                      </div>
                    </div>
                    <svg class="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AgentHeader from './agent/AgentHeader.vue';
import { onMounted, ref } from 'vue';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
};

onMounted(async () => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  isDark.value = saved === 'dark';
});

const openN8N = () => {
  // Open N8N in external browser
  const n8nUrl = 'http://localhost:30119';

  // Use Electron's shell to open external URL
  if (window.require) {
    const { shell } = window.require('electron');
    shell.openExternal(n8nUrl);
  } else {
    window.open(n8nUrl, '_blank');
  }
};
</script>

<style scoped>
/* Custom styles for automation detail page */
</style>

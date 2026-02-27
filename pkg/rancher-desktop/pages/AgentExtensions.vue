<template>
  <div class="min-h-screen bg-white text-sm text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans" :class="{ dark: isDark }">
    <PostHogTracker page-name="AgentExtensions" />
    <div class="flex min-h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex w-full flex-col">
        <div class="overflow-hidden bg-slate-900 dark:-mt-19 dark:-mb-32 dark:pt-19 dark:pb-32">
          <div class="py-16 sm:px-2 lg:relative lg:px-0 lg:py-20">
            <div class="mx-auto grid max-w-6xl md:grid-cols-2 items-center gap-x-8 gap-y-10 px-4 md:px-6 lg:px-8 xl:gap-x-16">
              <div class="relative z-10 md:text-center lg:text-left">
                <div class="relative">
                  <p class="inline bg-linear-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-5xl tracking-tight text-transparent">
                    Extensions.
                  </p>
                  <p class="mt-3 text-2xl tracking-tight text-slate-400">
                    Browse and install powerful extensions for Sulla Desktop.
                  </p>
                </div>
              </div>

              <div class="relative">
                <div class="flex flex-col gap-4">
                  <div class="relative">
                    <svg aria-hidden="true" viewBox="0 0 20 20" class="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 fill-slate-400 dark:fill-slate-500">
                      <path d="M16.293 17.707a1 1 0 0 0 1.414-1.414l-1.414 1.414ZM9 14a5 5 0 0 1-5-5H2a7 7 0 0 0 7 7v-2ZM4 9a5 5 0 0 1 5-5V2a7 7 0 0 0-7 7h2Zm5-5a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7v2Zm8.707 12.293-3.757-3.757-1.414 1.414 3.757 3.757 1.414-1.414ZM14 9a4.98 4.98 0 0 1-1.464 3.536l1.414 1.414A6.98 6.98 0 0 0 16 9h-2Zm-1.464 3.536A4.98 4.98 0 0 1 9 14v2a6.98 6.98 0 0 0 4.95-2.05l-1.414-1.414Z"></path>
                    </svg>

                    <input
                      v-model="search"
                      type="text"
                      placeholder="Search extensions"
                      class="h-11 w-full rounded-lg bg-white/95 pr-4 pl-12 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300/50 dark:bg-slate-800/75 dark:text-slate-100 dark:ring-white/5 dark:ring-inset"
                    >
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="flex h-6 rounded-full p-px text-xs font-medium"
                      :class="activeTab === 'catalog' ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                      @click="activeTab = 'catalog'"
                    >
                      <span class="flex items-center rounded-full px-2.5" :class="activeTab === 'catalog' ? 'bg-slate-800' : ''">Catalog</span>
                    </button>
                    <button
                      type="button"
                      class="flex h-6 rounded-full p-px text-xs font-medium"
                      :class="activeTab === 'installed' ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                      @click="activeTab = 'installed'"
                    >
                      <span class="flex items-center rounded-full px-2.5" :class="activeTab === 'installed' ? 'bg-slate-800' : ''">
                        Installed
                        <span v-if="installedExtensions.length" class="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500/20 px-1 text-[10px] text-sky-300">{{ installedExtensions.length }}</span>
                      </span>
                    </button>
                    <template v-if="activeTab === 'catalog'">
                      <span class="mx-1 h-4 w-px bg-slate-700"></span>
                      <button
                        v-for="category in categories"
                        :key="category"
                        type="button"
                        class="flex h-6 rounded-full p-px text-xs font-medium"
                        :class="activeCategory === category ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                        @click="activeCategory = activeCategory === category ? null : category"
                      >
                        <span class="flex items-center rounded-full px-2.5" :class="activeCategory === category ? 'bg-slate-800' : ''">{{ category }}</span>
                      </button>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-auto">
          <div class="mx-auto max-w-6xl px-4 py-6">
            <!-- Loading state -->
            <div
              v-if="loading"
              class="flex h-40 items-center justify-center text-sm text-white/60"
            >
              <svg class="mr-2 h-5 w-5 animate-spin text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading extensions...
            </div>

            <!-- Catalog tab -->
            <template v-if="!loading && activeTab === 'catalog'">
              <div
                v-if="filteredCatalog.length === 0"
                class="flex h-40 items-center justify-center text-sm text-[#0d0d0d]/60 dark:text-white/60"
              >
                No extensions found.
              </div>

              <div
                v-else
                class="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                <div
                  v-for="ext in filteredCatalog"
                  :key="ext.slug"
                  class="group relative overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200 transition-all duration-200 hover:shadow-lg hover:border-gray-300 dark:bg-slate-800 dark:border-gray-700 dark:hover:border-gray-600"
                >
                  <div class="p-6">
                    <div class="flex items-start justify-between mb-4">
                      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                        <img
                          v-if="ext.logo"
                          :src="ext.logo"
                          :alt="ext.title"
                          class="h-8 w-8 object-contain"
                        >
                        <span v-else class="text-2xl">📦</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-slate-500 dark:text-slate-400">v{{ ext.version }}</span>
                        <span
                          v-if="isInstalled(ext.slug)"
                          class="inline-flex items-center rounded-full bg-green-500/20 text-green-400 text-xs px-2 py-0.5 font-medium"
                        >
                          Installed
                        </span>
                      </div>
                    </div>

                    <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {{ ext.title }}
                    </h3>

                    <p class="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">
                      {{ ext.short_description }}
                    </p>

                    <div class="flex items-center justify-between">
                      <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                        {{ ext.publisher }}
                      </span>
                    </div>

                    <div class="flex items-center justify-between mt-4">
                      <!-- Error banner -->
                      <span
                        v-if="errors[ext.slug]"
                        class="text-xs text-red-400"
                      >{{ errors[ext.slug] }}</span>

                      <div class="flex items-center gap-2 ml-auto">
                        <button
                          v-if="!busy[ext.slug] && !isInstalled(ext.slug)"
                          class="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                          @click="install(ext)"
                        >
                          Install
                        </button>
                        <button
                          v-if="!busy[ext.slug] && canUpgrade(ext.slug)"
                          class="inline-flex items-center rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-700"
                          @click="upgrade(ext)"
                        >
                          Upgrade
                        </button>
                        <button
                          v-if="!busy[ext.slug] && isInstalled(ext.slug)"
                          class="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                          @click="uninstall(ext)"
                        >
                          Uninstall
                        </button>
                        <span
                          v-if="busy[ext.slug]"
                          class="inline-flex items-center gap-1.5 text-xs text-slate-400"
                        >
                          <svg class="h-4 w-4 animate-spin text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {{ busy[ext.slug] }}...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Installed tab -->
            <template v-if="!loading && activeTab === 'installed'">
              <div
                v-if="installedExtensions.length === 0"
                class="flex h-40 flex-col items-center justify-center gap-3 text-sm text-[#0d0d0d]/60 dark:text-white/60"
              >
                <span>No extensions installed yet.</span>
                <button
                  class="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                  @click="activeTab = 'catalog'"
                >
                  Browse Catalog
                </button>
              </div>

              <div
                v-else
                class="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                <div
                  v-for="ext in installedExtensions"
                  :key="ext.id"
                  class="group relative overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200 transition-all duration-200 hover:shadow-lg hover:border-gray-300 dark:bg-slate-800 dark:border-gray-700 dark:hover:border-gray-600"
                >
                  <div class="p-6">
                    <div class="flex items-start justify-between mb-4">
                      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                        <span class="text-2xl">📦</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-slate-500 dark:text-slate-400">v{{ ext.version }}</span>
                        <div class="h-2 w-2 rounded-full bg-green-500"></div>
                      </div>
                    </div>

                    <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {{ extensionTitle(ext) }}
                    </h3>

                    <p class="text-sm text-slate-600 dark:text-slate-300 mb-4">
                      {{ ext.id }}
                    </p>

                    <div class="flex items-center justify-between mt-3">
                      <div class="flex items-center gap-2">
                        <button
                          v-if="!busy[ext.id] && ext.canUpgrade"
                          class="inline-flex items-center rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-700"
                          @click="upgradeInstalled(ext)"
                        >
                          Upgrade to v{{ ext.availableVersion }}
                        </button>
                        <button
                          v-if="!busy[ext.id]"
                          class="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                          @click="uninstallById(ext.id)"
                        >
                          Uninstall
                        </button>
                        <span
                          v-if="busy[ext.id]"
                          class="inline-flex items-center gap-1.5 text-xs text-slate-400"
                        >
                          <svg class="h-4 w-4 animate-spin text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {{ busy[ext.id] }}...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AgentHeader from './agent/AgentHeader.vue';
import PostHogTracker from '@pkg/components/PostHogTracker.vue';
import { getExtensionService } from '@pkg/agent/services/ExtensionService';
import type { MarketplaceEntry, InstalledExtension } from '@pkg/agent/services/ExtensionService';

import { computed, onMounted, ref, reactive } from 'vue';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);
const extensionService = getExtensionService();

const search = ref('');
const activeTab = ref<'catalog' | 'installed'>('catalog');
const activeCategory = ref<string | null>(null);
const loading = ref(true);

const marketplaceData = ref<MarketplaceEntry[]>([]);
const installedExtensions = ref<InstalledExtension[]>([]);
const busy = reactive<Record<string, string | null>>({});
const errors = reactive<Record<string, string | null>>({});

const categories = computed(() => {
  const counts = new Map<string, number>();

  for (const ext of marketplaceData.value) {
    const cats = ext.labels?.['com.docker.extension.categories']?.split(',') ?? [];
    for (const cat of cats) {
      const trimmed = cat.trim();
      if (trimmed) {
        counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([category]) => category);
});

const filteredCatalog = computed(() => {
  const q = search.value.trim().toLowerCase();
  const category = activeCategory.value;

  return marketplaceData.value
    .filter((ext) => {
      if (category) {
        const cats = ext.labels?.['com.docker.extension.categories']?.split(',').map(c => c.trim()) ?? [];
        if (!cats.includes(category)) {
          return false;
        }
      }
      if (!q) {
        return true;
      }
      const hay = `${ext.title} ${ext.short_description} ${ext.publisher} ${ext.slug}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => a.title.localeCompare(b.title));
});

function isInstalled(slug: string): boolean {
  return installedExtensions.value.some(ext => ext.id === slug);
}

function canUpgrade(slug: string): boolean {
  return installedExtensions.value.some(ext => ext.id === slug && ext.canUpgrade);
}

function extensionTitle(ext: InstalledExtension): string {
  return ext.labels?.['org.opencontainers.image.title'] ?? ext.id;
}

async function refreshData() {
  const [marketplace, installed] = await Promise.all([
    extensionService.fetchMarketplaceData(),
    extensionService.fetchInstalledExtensions(),
  ]);

  marketplaceData.value = marketplace;
  installedExtensions.value = installed;
}

async function install(ext: MarketplaceEntry) {
  const id = `${ext.slug}:${ext.version}`;
  busy[ext.slug] = 'Installing';
  errors[ext.slug] = null;

  const result = await extensionService.installExtension(id);

  if (!result.ok) {
    errors[ext.slug] = result.error ?? 'Install failed';
  }

  busy[ext.slug] = null;
  await refreshData();
}

async function upgrade(ext: MarketplaceEntry) {
  const id = `${ext.slug}:${ext.version}`;
  busy[ext.slug] = 'Upgrading';
  errors[ext.slug] = null;

  const result = await extensionService.installExtension(id);

  if (!result.ok) {
    errors[ext.slug] = result.error ?? 'Upgrade failed';
  }

  busy[ext.slug] = null;
  await refreshData();
}

async function uninstall(ext: MarketplaceEntry) {
  busy[ext.slug] = 'Uninstalling';
  errors[ext.slug] = null;

  const result = await extensionService.uninstallExtension(ext.slug);

  if (!result.ok) {
    errors[ext.slug] = result.error ?? 'Uninstall failed';
  }

  busy[ext.slug] = null;
  await refreshData();
}

async function uninstallById(id: string) {
  busy[id] = 'Uninstalling';

  await extensionService.uninstallExtension(id);

  busy[id] = null;
  await refreshData();
}

async function upgradeInstalled(ext: InstalledExtension) {
  if (!ext.availableVersion) return;

  const id = `${ext.id}:${ext.availableVersion}`;
  busy[ext.id] = 'Upgrading';

  await extensionService.installExtension(id);

  busy[ext.id] = null;
  await refreshData();
}

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
};

onMounted(async () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {
    isDark.value = false;
  }

  try {
    await extensionService.initialize();
    await refreshData();
  } catch (error) {
    console.error('Failed to load extensions:', error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-clamp: 2;
}
</style>

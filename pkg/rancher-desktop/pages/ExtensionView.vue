<template>
  <div class="min-h-screen bg-white text-sm text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans" :class="{ dark: isDark }">
    <PostHogTracker page-name="Extension" />
    <div class="flex h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex w-full flex-col">
        <div class="overflow-hidden bg-slate-900 dark:-mt-19 dark:-mb-32 dark:pt-19 dark:pb-32">
          <div class="py-16 sm:px-2 lg:relative lg:px-0 lg:py-20">
            <div class="mx-auto flex flex-row items-center gap-x-8 gap-y-10 px-4 md:px-6 lg:px-8 xl:gap-x-16">
              <div class="relative z-10">
                <img v-if="extensionMetadata?.icon" 
                  :src="extensionIcon" 
                  :alt="extensionMetadata?.title" class="h-16 w-16 rounded-lg" />
              </div>
              <div class="relative z-10 md:text-center lg:text-left">
                <div class="relative">
                  <p class="inline bg-linear-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-5xl tracking-tight text-transparent">
                    {{ extensionMetadata?.title }}
                  </p>
                  <p class="mt-3 text-2xl tracking-tight text-slate-400">
                    {{ extensionMetadata?.description }}
                  </p>
                  <p class="mt-2 text-lg text-slate-500">
                    Version {{ extensionMetadata?.version }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <iframe :src="extensionContentUrl" class="w-full flex-1"></iframe>
    </div>
  </div>
</template>

<script setup lang="ts">
import AgentHeader from './agent/AgentHeader.vue';
import PostHogTracker from '@pkg/components/PostHogTracker.vue';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getExtensionService, LocalExtensionMetadata } from '@pkg/agent';
import { hexEncode } from '@pkg/utils/string-encode';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);
const route = useRoute();
const router = useRouter();

const extensionService = getExtensionService();
const extensionMetadata = ref<LocalExtensionMetadata | null>(null);
const extensionContentUrl = ref<string>('#');
const extensionIcon = ref<string>('');

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

  const name = route.params.name as string;
  const metadata = extensionService.getExtensionMetadata(name) ?? null;

  if (!metadata) {
    router.push('/');
    return;
  }

  const extensionHex = hexEncode(metadata.id);

  extensionMetadata.value = metadata;
  extensionContentUrl.value = `x-rd-extension://${ extensionHex }/ui/dashboard-tab/ui/index.html`;
  extensionIcon.value = `x-rd-extension://${ extensionHex }/icon.svg`;
});
</script>

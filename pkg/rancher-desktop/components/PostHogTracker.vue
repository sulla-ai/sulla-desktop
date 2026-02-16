<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { usePostHog } from '@pkg/composables/usePostHog';

const props = defineProps<{
  pageName: string;
}>();

const { enabled, capture } = usePostHog();

// Global registry to track which pages have been tracked
const trackedPages = new Set<string>();

function trackPageView() {
  if (enabled.value && !trackedPages.has(props.pageName)) {
    trackedPages.add(props.pageName);
    capture('$pageview', { page: props.pageName });
  }
}

function untrackPageView() {
  trackedPages.delete(props.pageName);
}

onMounted(async () => {
  await trackPageView();
});

onUnmounted(() => {
  untrackPageView();
});

watch(enabled, async (isEnabled, wasEnabled) => {
  if (isEnabled && !wasEnabled) {
    await trackPageView();
  }
});
</script>

<template>
  <!-- Renderless tracking component -->
</template>

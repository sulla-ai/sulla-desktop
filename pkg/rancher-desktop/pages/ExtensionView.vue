<template>
  <iframe :src="extensionUrl" class="w-full h-full" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const extensionUrl = computed(() => {
  // Hardcode for now
  if (route.params.id === 'voice-ai') {
    return 'http://localhost:8080';
  }
  return '';
});
</script>

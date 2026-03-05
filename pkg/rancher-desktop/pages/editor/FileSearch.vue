<template>
  <div class="search-container" :class="{ dark: isDark }">
    <div class="search-input-wrapper" :class="{ dark: isDark }">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        placeholder="Search files..."
        class="search-input"
        :class="{ dark: isDark }"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'FileSearch',
  
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    isDark: {
      type: Boolean,
      default: false
    }
  },

  emits: ['update:modelValue']
});
</script>

<style scoped>
.search-container {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  height: 100%;
}

.search-container.dark {
  background: #1e293b;
  border-bottom-color: #3c3c3c;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.search-input-wrapper.dark {
  background: #2d2d2d;
  border-color: #404040;
}

.search-container svg {
  color: #64748b;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: #333;
  font-size: 13px;
}

.search-input.dark {
  color: #ccc;
}

.search-input::placeholder {
  color: #94a3b8;
}

.search-input.dark::placeholder {
  color: #64748b;
}
</style>

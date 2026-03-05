<template>
  <div class="icon-panel" :class="{ dark: isDark }">
    <button class="icon-btn" :class="{ active: leftPaneVisible && !searchMode && !gitMode }" @click="toggleFileTree">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9,22 9,12 15,12 15,22"></polyline>
      </svg>
    </button>
    <button class="icon-btn" :class="{ active: searchMode }" @click="toggleSearch">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    </button>
    <button class="icon-btn" :class="{ active: gitMode }" @click="toggleGit">
      <svg width="21" height="21" viewBox="0 0 98 96" fill="currentColor">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.336-3.015.336-3.015 4.923.35 7.516 5.052 7.516 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.57 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 22.933-22.243 24.283 1.78 1.348 3.16 3.015 3.16 6.6 0 9.633-.08 17.45-.08 19.85 0 1.304.965 2.373 2.372 2.373 2.362 0 4.923-1.059 3.316-2.362C95.76 89.346 109.708 70.973 109.708 49.217 109.708 22 87.868 0 60.854 0h-12z"/>
      </svg>
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'IconPanel',
  
  props: {
    isDark: {
      type: Boolean,
      default: false
    },
    leftPaneVisible: {
      type: Boolean,
      default: true
    },
    searchMode: {
      type: Boolean,
      default: false
    },
    gitMode: {
      type: Boolean,
      default: false
    }
  },

  emits: [
    'toggle-file-tree',
    'toggle-search',
    'toggle-git'
  ],

  setup(props, { emit }) {
    function toggleFileTree() {
      emit('toggle-file-tree');
    }

    function toggleSearch() {
      emit('toggle-search');
    }

    function toggleGit() {
      emit('toggle-git');
    }

    return {
      toggleFileTree,
      toggleSearch,
      toggleGit
    };
  }
});
</script>

<style scoped>
.icon-panel {
  width: 45px;
  flex-shrink: 0;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  gap: 9px;
}

.icon-panel.dark {
  background: #1e293b;
  border-right-color: #3c3c3c;
}

.icon-btn {
  width: 45px;
  height: 45px;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  position: relative;
}

.icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #334155;
}

.icon-btn.active {
  background: rgba(0, 0, 0, 0.1);
  color: #0078d4;
}

.dark .icon-btn {
  color: #94a3b8;
}

.dark .icon-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
}

.dark .icon-btn.active {
  background: rgba(255, 255, 255, 0.1);
  color: #0078d4;
}

.icon-btn svg {
  width: 21px;
  height: 21px;
}

.icon-btn.active::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #0078d4;
  border-top-right-radius: 3px;
  border-bottom-right-radius: 3px;
}
</style>

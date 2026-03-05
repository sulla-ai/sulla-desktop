<template>
  <div class="git-pane" :class="{ dark: isDark }">
    <GitChanges :git-changes="gitChanges" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import GitChanges from './GitChanges.vue';

export default defineComponent({
  name: 'GitPane',
  
  props: {
    gitChanges: {
      type: Array as () => {status: string, file: string}[],
      default: () => []
    },
    isDark: {
      type: Boolean,
      default: false
    }
  },

  components: {
    GitChanges
  }
});
</script>

<style scoped>
.git-pane {
  flex: 1;
  overflow-y: auto;
  background: #f8fafc;
}

.git-pane.dark {
  background: #1e293b;
}
</style>

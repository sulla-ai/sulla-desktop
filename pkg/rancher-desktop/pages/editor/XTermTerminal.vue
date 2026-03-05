<template>
  <div ref="terminalElement" class="terminal-wrapper"></div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default defineComponent({
  name: 'XTermTerminal',
  
  props: {
    isDark: {
      type: Boolean,
      default: false
    }
  },

  setup(props) {
    const terminalElement = ref<HTMLElement>();
    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;

    const initializeTerminal = () => {
      if (!terminalElement.value || terminal) return;

      terminal = new Terminal({
        theme: {
          background: props.isDark ? '#1e293b' : '#ffffff',
          foreground: props.isDark ? '#ccc' : '#333',
        }
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(terminalElement.value);
      fitAddon.fit();
      terminal.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ');
    };

    const updateTheme = () => {
      if (!terminal) return;
      
      terminal.options.theme = {
        background: props.isDark ? '#1e293b' : '#ffffff',
        foreground: props.isDark ? '#ccc' : '#333',
      };
    };

    const fitTerminal = () => {
      if (fitAddon) {
        fitAddon.fit();
      }
    };

    onMounted(() => {
      initializeTerminal();
      window.addEventListener('resize', fitTerminal);
    });

    onBeforeUnmount(() => {
      window.removeEventListener('resize', fitTerminal);
      if (terminal) {
        terminal.dispose();
        terminal = null;
      }
    });

    watch(() => props.isDark, updateTheme);

    return {
      terminalElement
    };
  }
});
</script>

<style scoped>
.terminal-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.terminal-wrapper :deep(.xterm) {
  height: 100%;
}
</style>

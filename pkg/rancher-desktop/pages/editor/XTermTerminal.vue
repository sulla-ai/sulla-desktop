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
      default: true,
    },
    wsUrl: {
      type: String,
      default: 'ws://127.0.0.1:6108',
    },
    sessionId: {
      type: String,
      default: '',
    },
    fontSize: {
      type: Number,
      default: 14,
    },
    fontFamily: {
      type: String,
      default: 'Menlo, Monaco, "Courier New", monospace',
    },
  },

  emits: ['connected', 'disconnected', 'error'],

  setup(props, { emit }) {
    const terminalElement = ref<HTMLElement>();
    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let socket: WebSocket | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const getTheme = () => ({
      background: props.isDark ? '#1e293b' : '#f8fafc',
      foreground: props.isDark ? '#ccc' : '#333',
      cursor: props.isDark ? '#ccc' : '#333',
    });

    const sendResize = () => {
      if (!fitAddon || !socket || socket.readyState !== WebSocket.OPEN) return;
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        socket.send(JSON.stringify({
          type: 'resize',
          cols: dims.cols,
          rows: dims.rows,
        }));
      }
    };

    const fitTerminal = () => {
      if (fitAddon) {
        fitAddon.fit();
        sendResize();
      }
    };

    const connectWebSocket = () => {
      if (!terminal || !fitAddon) return;

      socket = new WebSocket(props.wsUrl);

      socket.onopen = () => {
        // Send start message to create/join a PTY session in the Lima VM
        const dims = fitAddon!.proposeDimensions();
        socket!.send(JSON.stringify({
          type: 'start',
          sessionId: props.sessionId || undefined,
          cols: dims?.cols || 80,
          rows: dims?.rows || 24,
        }));
        emit('connected');
      };

      socket.onmessage = (event: MessageEvent) => {
        terminal!.write(event.data);
      };

      socket.onclose = () => {
        terminal!.write('\r\n\x1B[1;31mDisconnected.\x1B[0m\r\n');
        emit('disconnected');
      };

      socket.onerror = () => {
        emit('error');
      };
    };

    const initializeTerminal = () => {
      if (!terminalElement.value || terminal) return;

      terminal = new Terminal({
        cursorBlink: true,
        theme: getTheme(),
        fontFamily: props.fontFamily,
        fontSize: props.fontSize,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(terminalElement.value);
      fitAddon.fit();

      terminal.onData((data: string) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(data);
        }
      });

      resizeObserver = new ResizeObserver(() => fitTerminal());
      resizeObserver.observe(terminalElement.value);

      connectWebSocket();
    };

    const updateTheme = () => {
      if (terminal) {
        terminal.options.theme = getTheme();
      }
    };

    onMounted(() => {
      initializeTerminal();
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      socket?.close();
      socket = null;
      terminal?.dispose();
      terminal = null;
    });

    watch(() => props.isDark, updateTheme);

    return {
      terminalElement,
    };
  },
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

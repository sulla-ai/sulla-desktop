<template>
  <div class="editor-chat" :class="{ dark: isDark }">
    <!-- Header -->
    <div class="chat-header" :class="{ dark: isDark }">
      <span class="chat-header-title">Chat</span>
    </div>

    <!-- Messages -->
    <div ref="messagesEl" class="chat-messages" :class="{ dark: isDark }">
      <!-- Empty state -->
      <div v-if="messages.length === 0" class="chat-empty">
        <p class="chat-empty-text">Ask anything about your code</p>
      </div>

      <div v-for="msg in messages" :key="msg.id" class="chat-message" :class="[msg.role]">
        <!-- User bubble -->
        <div v-if="msg.role === 'user'" class="bubble user-bubble" :class="{ dark: isDark }">
          <div class="bubble-content">{{ msg.content }}</div>
        </div>

        <!-- Assistant bubble -->
        <div v-else class="bubble assistant-bubble" :class="{ dark: isDark }">
          <div class="bubble-content" v-html="msg.html || msg.content"></div>
        </div>
      </div>
    </div>

    <!-- Composer -->
    <div class="chat-composer" :class="{ dark: isDark }">
      <textarea
        ref="inputEl"
        v-model="query"
        class="chat-input"
        :class="{ dark: isDark }"
        placeholder="Ask a question..."
        rows="1"
        @keydown.enter.exact.prevent="send"
        @input="autoGrow"
      ></textarea>
      <button
        class="chat-send-btn"
        :class="{ dark: isDark }"
        :disabled="!query.trim()"
        @click="send"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.724 1.053a.5.5 0 0 1 .54-.068l12 6a.5.5 0 0 1 0 .894l-12 6A.5.5 0 0 1 1.5 13.5v-4.9l7-1.1-7-1.1V1.5a.5.5 0 0 1 .224-.447Z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';

defineProps<{
  isDark: boolean;
}>();

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  html?: string;
}

const messages = ref<ChatMessage[]>([]);
const query = ref('');
const messagesEl = ref<HTMLElement>();
const inputEl = ref<HTMLTextAreaElement>();
let msgCounter = 0;

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
    }
  });
}

function autoGrow() {
  const el = inputEl.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function send() {
  const text = query.value.trim();
  if (!text) return;

  messages.value.push({
    id:      `msg-${++msgCounter}`,
    role:    'user',
    content: text,
  });

  query.value = '';
  nextTick(() => {
    if (inputEl.value) {
      inputEl.value.style.height = 'auto';
    }
  });
  scrollToBottom();
}
</script>

<style scoped>
.editor-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 35px;
  background: #f8fafc;
  border-bottom: 1px solid #cbd5e1;
  flex-shrink: 0;
}

.chat-header.dark {
  background: #1e293b;
  border-bottom-color: #3c3c3c;
}

.chat-header-title {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.chat-header.dark .chat-header-title {
  color: #ccc;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-messages.dark::-webkit-scrollbar {
  width: 6px;
}

.chat-messages.dark::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.chat-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-empty-text {
  font-size: 13px;
  color: #999;
}

.chat-message.user {
  display: flex;
  justify-content: flex-end;
}

.chat-message.assistant {
  display: flex;
  justify-content: flex-start;
}

.bubble {
  max-width: 92%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.user-bubble {
  background: #e0f2fe;
  color: #0c4a6e;
}

.user-bubble.dark {
  background: rgba(56, 189, 248, 0.15);
  color: #e0f2fe;
}

.assistant-bubble {
  background: #f1f5f9;
  color: #334155;
}

.assistant-bubble.dark {
  background: #2d3748;
  color: #cbd5e1;
}

.bubble-content {
  white-space: pre-wrap;
}

.chat-composer {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid #cbd5e1;
  background: #f8fafc;
  flex-shrink: 0;
}

.chat-composer.dark {
  border-top-color: #3c3c3c;
  background: #1e293b;
}

.chat-input {
  flex: 1;
  resize: none;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.4;
  background: #fff;
  color: #333;
  outline: none;
  min-height: 34px;
  max-height: 120px;
  overflow-y: auto;
}

.chat-input:focus {
  border-color: #0078d4;
}

.chat-input.dark {
  background: #0f172a;
  color: #e2e8f0;
  border-color: #475569;
}

.chat-input.dark:focus {
  border-color: #60a5fa;
}

.chat-send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: #0078d4;
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.1s;
}

.chat-send-btn:hover:not(:disabled) {
  background: #106ebe;
}

.chat-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chat-send-btn.dark {
  background: #2563eb;
}

.chat-send-btn.dark:hover:not(:disabled) {
  background: #3b82f6;
}
</style>

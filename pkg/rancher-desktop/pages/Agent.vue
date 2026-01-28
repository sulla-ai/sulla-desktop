<template>
  <div class="agent">
    <h1>Sulla</h1>
    <div class="avatar">🤖</div>
    <input
      v-model="query"
      type="text"
      placeholder="Ask me anything..."
      @keyup.enter="send"
    >
    <div class="response">
      {{ response }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const query = ref('');
const response = ref('');

const send = () => {
  response.value = `Echo: ${query.value}`;
};
</script>

<style scoped>
.agent {
  text-align: center;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  font-weight: 300;
  letter-spacing: 0.2em;
}

.avatar {
  font-size: 8rem;
  margin: 2rem 0;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

input {
  width: 80%;
  max-width: 500px;
  padding: 1rem 1.5rem;
  margin: 1rem;
  border: none;
  border-radius: 2rem;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  outline: none;
  transition: background 0.3s;
}

input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

input:focus {
  background: rgba(255, 255, 255, 0.2);
}

.response {
  margin-top: 2rem;
  padding: 1rem;
  min-height: 2rem;
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.8);
}
</style>

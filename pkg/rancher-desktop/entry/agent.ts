/**
 * This is the entry point for the Agent window.
 */

import { createApp } from 'vue';

import './agent-tailwind.css';

import Agent from '../pages/Agent.vue';

const app = createApp(Agent);

app.mount('#app');

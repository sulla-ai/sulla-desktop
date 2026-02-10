/**
 * This is the entry point for the Agent window.
 */

import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';

import './agent-tailwind.css';

import AgentRouter from '../pages/AgentRouter.vue';
import Agent from '../pages/Agent.vue';
import AgentCalendar from '../pages/AgentCalendar.vue';
import AgentKnowledgeBase from '../pages/AgentKnowledgeBase.vue';
import AgentKnowledgeBaseCreate from '../pages/AgentKnowledgeBaseCreate.vue';
import AgentIntegrations from '../pages/AgentIntegrations.vue';
import AgentIntegrationDetail from '../pages/AgentIntegrationDetail.vue';
import AgentKnowledgeBaseSections from '../pages/AgentKnowledgeBaseSections.vue';
import FirstRun from '../pages/FirstRun.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes:  [
    { path: '/', redirect: '/Chat' },
    { path: '/Chat', component: Agent, name: 'AgentChat' },
    { path: '/Calendar', component: AgentCalendar, name: 'AgentCalendar' },
    { path: '/KnowledgeBase', component: AgentKnowledgeBase, name: 'AgentKnowledgeBase' },
    { path: '/KnowledgeBase/Create', component: AgentKnowledgeBaseCreate, name: 'AgentKnowledgeBaseCreate' },
    { path: '/KnowledgeBase/Sections', component: AgentKnowledgeBaseSections, name: 'AgentKnowledgeBaseSections' },
    { path: '/Integrations', component: AgentIntegrations, name: 'AgentIntegrations' },
    { path: '/Integrations/:id', component: AgentIntegrationDetail, name: 'AgentIntegrationDetail' },
    { path: '/FirstRun', component: FirstRun, name: 'FirstRun' },
  ],
});

const app = createApp(AgentRouter);

app.use(router);

app.mount('#app');

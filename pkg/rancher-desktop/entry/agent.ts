/**
 * This is the entry point for the Agent window.
 */
// hoping this is the absolute earliest we can run in the renderer context
import { initiateWindowContext } from '@pkg/sulla';
await initiateWindowContext();

import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';

import './agent-tailwind.css';

import AgentRouter from '../pages/AgentRouter.vue';
import Agent from '../pages/Agent.vue';
import AgentCalendar from '../pages/AgentCalendar.vue';
import AgentKnowledgeBase from '../pages/AgentKnowledgeBase.vue';
import AgentKnowledgeBaseCreate from '../pages/AgentKnowledgeBaseCreate.vue';
import AgentKnowledgeBaseSearch from '../pages/AgentKnowledgeBaseSearch.vue';
import AgentIntegrations from '../pages/AgentIntegrations.vue';
import AgentIntegrationDetail from '../pages/AgentIntegrationDetail.vue';
import AgentAutomations from '../pages/AgentAutomations.vue';
import AgentKnowledgeBaseSections from '../pages/AgentKnowledgeBaseSections.vue';
import AgentKnowledgeBaseEdit from '../pages/AgentKnowledgeBaseEdit.vue';
import FirstRun from '../pages/FirstRun.vue';
import ExtensionView from '../pages/ExtensionView.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes:  [
    { path: '/', redirect: '/Chat' },
    { path: '/Chat', component: Agent, name: 'AgentChat' },
    { path: '/Calendar', component: AgentCalendar, name: 'AgentCalendar' },
    { path: '/KnowledgeBase', component: AgentKnowledgeBase, name: 'AgentKnowledgeBase' },
    { path: '/KnowledgeBase/Search', component: AgentKnowledgeBaseSearch, name: 'AgentKnowledgeBaseSearch' },
    { path: '/KnowledgeBase/Create', component: AgentKnowledgeBaseCreate, name: 'AgentKnowledgeBaseCreate' },
    { path: '/KnowledgeBase/Sections', component: AgentKnowledgeBaseSections, name: 'AgentKnowledgeBaseSections' },
    { path: '/KnowledgeBase/Edit/:slug', component: AgentKnowledgeBaseEdit, name: 'AgentKnowledgeBaseEdit' },
    { path: '/Integrations', component: AgentIntegrations, name: 'AgentIntegrations' },
    { path: '/Integrations/:id', component: AgentIntegrationDetail, name: 'AgentIntegrationDetail' },
    { path: '/Automations', component: AgentAutomations, name: 'AgentAutomations' },
    { path: '/FirstRun', component: FirstRun, name: 'FirstRun' },
    { path: '/extension/:id', component: ExtensionView, name: 'ExtensionView' },
  ],
});

const app = createApp(AgentRouter);

app.use(router);

app.mount('#app');

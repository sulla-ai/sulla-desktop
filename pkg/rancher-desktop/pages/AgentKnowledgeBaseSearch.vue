<template>
  <div class="min-h-screen bg-white text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans"
    :class="{ dark: isDark }">
    <PostHogTracker page-name="AgentKnowledgeBaseSearch" />
    <div class="flex min-h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex w-full flex-col">
        <div class="overflow-hidden bg-slate-900 dark:-mt-19 dark:-mb-32 dark:pt-19 dark:pb-32 relative min-h-[400px]">
          <img alt="" width="530" height="530" decoding="async" data-nimg="1"
            class="absolute right-full bottom-full -mr-72 -mb-56 opacity-50" style="color:transparent"
            :src="splashUrl">
          <img alt="" width="530" height="530" decoding="async" data-nimg="1" 
            class="absolute -top-64 -right-64"
            style="color:transparent" :src="splashUrl">
          <img alt="" width="567" height="567" decoding="async" data-nimg="1"
            class="absolute -right-44 -bottom-40" style="color:transparent" :src="splash2Url">
          
          <div class="absolute inset-0 z-0 opacity-30">
            <KnowledgeGraph />
          </div>

          <!-- Overlay content with toggle -->
          <div class="relative z-10">
            <div class="absolute top-4 right-4 z-20">
              <button 
                @click="showOverlay = !showOverlay"
                class="px-4 py-2 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-white/90 hover:text-white text-sm font-medium transition-all duration-300 backdrop-blur-sm border border-slate-600/50 shadow-lg"
              >
                {{ showOverlay ? 'Hide Overlay' : 'Show Overlay' }}
              </button>
            </div>

            <div 
              v-if="showOverlay"
              class="py-16 sm:px-2 lg:relative lg:px-0 lg:py-20 transition-all duration-500"
            >
              <div
                class="mx-auto grid max-w-2xl grid-cols-1 items-center gap-x-8 gap-y-16 px-4 lg:max-w-8xl lg:grid-cols-2 lg:px-8 xl:gap-x-16 xl:px-12">
                <div class="relative z-10 md:text-center lg:text-left">
                  <div class="relative">
                    <p
                      class="inline bg-linear-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-5xl tracking-tight text-transparent">
                      Sulla KnowledgeBase.</p>
                    <p class="mt-3 text-2xl tracking-tight text-slate-400">
                      Long-term memories Sulla has collected and organized through dreaming.
                    </p>
                    <div class="mt-8 flex gap-4 md:justify-center lg:justify-start">
                      <router-link
                        to="/KnowledgeBase/Create"
                        class="text-sm font-semibold rounded-full bg-sky-300 py-2 px-4 text-sm font-semibold text-slate-900 hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/50 active:bg-sky-500"
                      >
                        Create new page
                      </router-link>
                      <a
                        class="rounded-full bg-slate-800 py-2 px-4 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 active:text-slate-400"
                        href="#"
                        @click.prevent="$router.push('/KnowledgeBase/Sections')"
                      >
                        Manage Sections
                      </a>
                    </div>
                  </div>
                </div>
                <div class="relative lg:static xl:pl-10">
                  <div class="flex flex-col gap-4">
                    <div class="relative">
                      <svg aria-hidden="true" viewBox="0 0 20 20" class="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 fill-slate-400 dark:fill-slate-500">
                        <path d="M16.293 17.707a1 1 0 0 0 1.414-1.414l-1.414 1.414ZM9 14a5 5 0 0 1-5-5H2a7 7 0 0 0 7 7v-2ZM4 9a5 5 0 0 1 5-5V2a7 7 0 0 0-7 7h2Zm5-5a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7v2Zm8.707 12.293-3.757-3.757-1.414 1.414 3.757 3.757 1.414-1.414ZM14 9a4.98 4.98 0 0 1-1.464 3.536l1.414 1.414A6.98 6.98 0 0 0 16 9h-2Zm-1.464 3.536A4.98 4.98 0 0 1 9 14v2a6.98 6.98 0 0 0 4.95-2.05l-1.414-1.414Z"></path>
                      </svg>

                      <input
                        v-model="searchInput"
                        type="text"
                        placeholder="Search knowledge base"
                        class="h-11 w-full rounded-lg bg-white/95 pr-4 pl-12 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300/50 dark:bg-slate-800/75 dark:text-slate-100 dark:ring-white/5 dark:ring-inset"
                        @keydown.enter="performSearch"
                      >
                      <kbd class="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 font-medium text-slate-400 md:block dark:text-slate-500">
                        <kbd class="font-sans">⌘</kbd><kbd class="font-sans">K</kbd>
                      </kbd>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        class="flex h-6 rounded-full p-px text-xs font-medium"
                        :class="activeCategory === null ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                        @click="selectCategory(null)"
                      >
                        <span class="flex items-center rounded-full px-2.5" :class="activeCategory === null ? 'bg-slate-800' : ''">All</span>
                      </button>
                      <button
                        v-for="category in categories"
                        :key="category"
                        type="button"
                        class="flex h-6 rounded-full p-px text-xs font-medium"
                        :class="activeCategory === category ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                        @click="selectCategory(category)"
                      >
                        <span class="flex items-center rounded-full px-2.5" :class="activeCategory === category ? 'bg-slate-800' : ''">{{ category }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="relative mx-auto flex w-full max-w-8xl flex-auto justify-center sm:px-2 lg:px-8 xl:px-12">
          <div class="hidden lg:relative lg:block lg:flex-none">
            <div class="absolute inset-y-0 right-0 w-[50vw] bg-slate-50 dark:hidden"></div>
            <div class="absolute top-16 right-0 bottom-0 hidden h-12 w-px bg-linear-to-t from-slate-800 dark:block"></div>
            <div class="absolute top-28 right-0 bottom-0 hidden w-px bg-slate-800 dark:block"></div>
            <div class="sticky top-19 -ml-0.5 h-[calc(100vh-4.75rem)] w-64 overflow-x-hidden overflow-y-auto py-16 pr-8 pl-0.5 xl:w-72 xl:pr-16">
              <nav class="text-base lg:text-sm">
                <ul role="list" class="space-y-9">
                  <li v-if="loadingPages" class="text-sm text-slate-500 dark:text-slate-400">Loading…</li>
                  <li v-else-if="nav.length === 0" class="text-sm text-slate-500 dark:text-slate-400">No KnowledgeBase pages found.</li>
                  <li v-for="group in nav" :key="group.tag">
                    <h2 class="font-display font-medium text-slate-900 dark:text-white">{{ group.tag }}</h2>
                    <ul role="list" class="mt-2 space-y-2 border-l-2 border-slate-100 lg:mt-4 lg:space-y-4 lg:border-slate-200 dark:border-slate-800">
                      <li v-for="p in group.pages" :key="p.slug" class="relative">
                        <a
                          href="#"
                          class="block w-full pl-3.5 before:pointer-events-none before:absolute before:top-1/2 before:-left-1 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full"
                          :class="activeSlug === p.slug
                            ? 'font-semibold text-sky-500 before:bg-sky-500'
                            : 'text-slate-500 before:hidden before:bg-slate-300 hover:text-slate-600 hover:before:block dark:text-slate-400 dark:before:bg-slate-700 dark:hover:text-slate-300'"
                          @click.prevent="selectPage(p.slug)"
                        >
                          {{ p.title }}
                        </a>
                      </li>
                    </ul>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          <div class="w-full px-4 py-16">
            <!-- Search Results in Blog Format -->
            <div v-if="searchResults.length > 0" class="space-y-8">
              <div class="text-center mb-8">
                <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Search Results</h2>
                <p class="text-slate-600 dark:text-slate-400 mt-2">{{ searchResults.length }} articles found</p>
              </div>
              
              <article v-for="article in paginatedResults" :key="article.slug" class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6 hover:shadow-md transition-shadow">
                <div class="flex items-center gap-3 mb-3">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300">
                    {{ (article.tags && article.tags[0]) || 'Article' }}
                  </span>
                  <span class="text-sm text-slate-500 dark:text-slate-400" v-if="article.updated_at">
                    {{ new Date(article.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
                  </span>
                </div>
                <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  <a href="#" @click.prevent="selectPage(article.slug)" class="block">{{ article.title }}</a>
                </h3>
                  <p class="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">{{ getArticleIntro(article.excerpt) }}</p>
                <div class="flex items-center justify-between">
                  <a href="#" @click.prevent="selectPage(article.slug)" class="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 font-medium inline-flex items-center gap-2 transition-colors">
                    Read full article
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </a>
                </div>
              </article>

              <div class="flex justify-between items-center mt-12" v-if="searchResults.length > pageSize">
                <button @click="page = Math.max(1, page - 1)" :disabled="page <= 1" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Previous</button>
                <span class="text-slate-700 dark:text-slate-300">Page {{ page }} of {{ Math.ceil(searchResults.length / pageSize) }}</span>
                <button @click="page = Math.min(Math.ceil(searchResults.length / pageSize), page + 1)" :disabled="page >= Math.ceil(searchResults.length / pageSize)" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Next</button>
              </div>
            </div>

            <!-- Category Filtered Results -->
            <div v-else-if="categoryTitle" class="space-y-8">
              <div class="text-center mb-8">
                <h2 class="text-2xl font-bold text-slate-900 dark:text-white">{{ categoryTitle === '' ? 'All Articles' : `Articles in ${categoryTitle}` }}</h2>
                <p class="text-slate-600 dark:text-slate-400 mt-2">{{ filteredPages.length }} articles</p>
              </div>
              
              <article v-for="article in paginatedResults" :key="article.slug" class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6 hover:shadow-md transition-shadow">
                <div class="flex items-center gap-3 mb-3">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300">
                    {{ (article.tags && article.tags[0]) || 'Article' }}
                  </span>
                  <span class="text-sm text-slate-500 dark:text-slate-400" v-if="article.updated_at">
                    {{ new Date(article.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
                  </span>
                </div>
                <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  <a href="#" @click.prevent="selectPage(article.slug)" class="block">{{ article.title }}</a>
                </h3>
                  <p class="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">{{ getArticleIntro(article.excerpt) }}</p>
                <div class="flex items-center justify-between">
                  <a href="#" @click.prevent="selectPage(article.slug)" class="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 font-medium inline-flex items-center gap-2 transition-colors">
                    Read full article
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </a>
                </div>
              </article>

              <div class="flex justify-between items-center mt-12" v-if="filteredPages.length > pageSize">
                <button @click="page = Math.max(1, page - 1)" :disabled="page <= 1" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Previous</button>
                <span class="text-slate-700 dark:text-slate-300">Page {{ page }} of {{ Math.ceil(filteredPages.length / pageSize) }}</span>
                <button @click="page = Math.min(Math.ceil(filteredPages.length / pageSize), page + 1)" :disabled="page >= Math.ceil(filteredPages.length / pageSize)" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Next</button>
              </div>
            </div>

            <!-- Default State - Show Results Without Header -->
            <div v-else-if="!activePage" class="space-y-8">
              <article v-for="article in paginatedResults" :key="article.slug" class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6 hover:shadow-md transition-shadow">
                <!-- Header row: Title left, Date/Tag right -->
                <div class="flex justify-between items-start mb-4">
                  <h3 class="text-xl font-bold text-slate-900 dark:text-white flex-1 mr-4">{{ article.title }}</h3>
                  <div class="flex flex-col items-end gap-2 text-right">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300">
                      {{ (article.tags && article.tags[0]) || 'Article' }}
                    </span>
                    <span class="text-sm text-slate-500 dark:text-slate-400" v-if="article.updated_at">
                      {{ new Date(article.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
                    </span>
                  </div>
                </div>
                
                <!-- Content -->
                <p class="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">{{ article.excerpt }}</p>
                
                <!-- Footer: Optional info left, Read button right -->
                <div class="flex justify-between items-center">
                  <div class="text-sm text-slate-500 dark:text-slate-400">
                    <!-- Optional additional info can go here -->
                  </div>
                  <a href="#" @click.prevent="selectPage(article.slug)" class="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 font-medium inline-flex items-center gap-2 transition-colors">
                    Read the article
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </a>
                </div>
              </article>

              <div class="flex justify-between items-center mt-12" v-if="filteredPages.length > pageSize">
                <button @click="page = Math.max(1, page - 1)" :disabled="page <= 1" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Previous</button>
                <span class="text-slate-700 dark:text-slate-300">Page {{ page }} of {{ Math.ceil(filteredPages.length / pageSize) }}</span>
                <button @click="page = Math.min(Math.ceil(filteredPages.length / pageSize), page + 1)" :disabled="page >= Math.ceil(filteredPages.length / pageSize)" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Next</button>
              </div>
            </div>

            <!-- Individual Article View -->
            <article v-else-if="activePage">
              <header class="mb-9 space-y-1">
                <p class="font-display text-sm font-medium text-sky-500">{{ (activePage.tags && activePage.tags[0]) || 'Memory' }}</p>
                <h1 class="font-display text-3xl tracking-tight text-slate-900 dark:text-white">{{ activePage.title }}</h1>
              </header>
              <div
                ref="articleContentEl"
                class="prose max-w-none prose-slate dark:text-slate-400 dark:prose-invert prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-34 prose-lead:text-slate-500 dark:prose-lead:text-slate-400 prose-a:font-semibold dark:prose-a:text-sky-400 dark:[--tw-prose-background:var(--color-slate-900)] prose-a:no-underline prose-a:shadow-[inset_0_-2px_0_0_var(--tw-prose-background,#fff),inset_0_calc(-1*(var(--tw-prose-underline-size,4px)+2px))_0_0_var(--tw-prose-underline,var(--color-sky-300))] prose-a:hover:[--tw-prose-underline-size:6px] dark:prose-a:shadow-[inset_0_calc(-1*var(--tw-prose-underline-size,2px))_0_0_var(--tw-prose-underline,var(--color-sky-800))] dark:prose-a:hover:[--tw-prose-underline-size:6px] prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:shadow-lg dark:prose-pre:bg-slate-800/60 dark:prose-pre:shadow-none dark:prose-pre:ring-1 dark:prose-pre:ring-slate-300/10 dark:prose-hr:border-slate-800"
                v-html="renderedContent"></div>

              <dl v-if="prevPage || nextPage" class="mt-12 flex border-t border-slate-200 pt-6 dark:border-slate-800">
                <div v-if="prevPage">
                  <dt class="font-display text-sm font-medium text-slate-900 dark:text-white">Previous</dt>
                  <dd class="mt-1">
                    <a
                      class="flex items-center gap-x-1 text-base font-semibold text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 flex-row-reverse"
                      href="#"
                      @click.prevent="selectPage(prevPage.slug)"
                    >
                      {{ prevPage.title }}
                      <svg viewBox="0 0 16 16" aria-hidden="true" class="h-4 w-4 flex-none fill-current -scale-x-100">
                        <path d="m9.182 13.423-1.17-1.16 3.505-3.505H3V7.065h8.517l-3.506-3.5L9.181 2.4l5.512 5.511-5.511 5.512Z"></path>
                      </svg>
                    </a>
                  </dd>
                </div>
                <div v-if="nextPage" class="ml-auto text-right">
                  <dt class="font-display text-sm font-medium text-slate-900 dark:text-white">Next</dt>
                  <dd class="mt-1">
                    <a
                      class="flex items-center gap-x-1 text-base font-semibold text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
                      href="#"
                      @click.prevent="selectPage(nextPage.slug)"
                    >
                      {{ nextPage.title }}
                      <svg viewBox="0 0 16 16" aria-hidden="true" class="h-4 w-4 flex-none fill-current">
                        <path d="m9.182 13.423-1.17-1.16 3.505-3.505H3V7.065h8.517l-3.506-3.5L9.181 2.4l5.512 5.511-5.511 5.512Z"></path>
                      </svg>
                    </a>
                  </dd>
                </div>
              </dl>
            </article>

            <!-- Loading State -->
            <article v-else-if="loadingPage" class="py-16 text-center text-slate-500 dark:text-slate-400">
              Loading...
            </article>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AgentHeader from './agent/AgentHeader.vue';
import KnowledgeGraph from './KnowledgeGraph.vue';
import PostHogTracker from '@pkg/components/PostHogTracker.vue';
import { onMounted, ref, watch, computed } from 'vue';
import { articlesRegistry } from '../agent/database/registry/ArticlesRegistry';
import { useRouter, useRoute } from 'vue-router';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import './assets/AgentKnowledgeBase.css';
import type { ArticleListItem, ArticleWithContent } from '../agent/database/registry/ArticlesRegistry';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);
const showOverlay = ref(true);  // ← new toggle state

const router = useRouter();
const route = useRoute();

const query = ref('');
const activeCategory = ref<string | null>(null);
const searchInput = ref('');
const page = ref(1);
const pageSize = 10;
const categoryTitle = ref('');
const searchResults = ref<ArticleListItem[]>([]);

const splashUrl = new URL('./assets/splash.png', import.meta.url).toString();
const splash2Url = new URL('./assets/splash2.png', import.meta.url).toString();

const loadingPages = ref(false);
const pages = ref<ArticleListItem[]>([]);
const activeSlug = ref<string | null>(null);
const activePage = ref<ArticleWithContent | null>(null);
const loadingPage = ref(false);
const articleContentEl = ref<HTMLElement | null>(null);

interface TocHeading {
  id: string;
  text: string;
  level: number;
}

const getArticleIntro = (excerpt: string): string => {
  if (!excerpt) return '';
  
  // Clean up the excerpt and take first 250 characters, ending at word boundary
  const cleanExcerpt = excerpt.replace(/\s+/g, ' ').trim();
  if (cleanExcerpt.length <= 250) return cleanExcerpt;
  
  // Find the last space before 250 characters
  const truncated = cleanExcerpt.substring(0, 250);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > 0) {
    return truncated.substring(0, lastSpaceIndex) + '...';
  }
  
  return truncated + '...';
};

function slugifyHeading(text: string): string {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

function scrollToHeading(id: string): void {
  const targetId = String(id || '').trim();
  if (!targetId) return;

  const container = articleContentEl.value;
  const el = container?.querySelector(`[id="${targetId}"]`) || document.getElementById(targetId);
  if (!el) return;

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const renderedContent = computed(() => {
  if (!activePage.value?.document) return '<p class="text-slate-500">No content available.</p>';

  const markdown = activePage.value.document;

  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = tokens.map((t: any) => t.text || '').join('');
    const id = slugifyHeading(text);
    return `<h${depth} id="${id}">${marked.parseInline(text)}</h${depth}>`;
  };

  const html = marked(markdown, { renderer }) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|gif|jpe?g|webp);base64,|\/|\.|#)/i,
  });
});

const tableOfContents = computed<TocHeading[]>(() => {
  if (!renderedContent.value) return [];

  const headings: TocHeading[] = [];
  const regex = /<h([12])[^>]*id="([^"]*)"[^>]*>([^<]*)<\/h[12]>/gi;
  let match;
  while ((match = regex.exec(renderedContent.value)) !== null) {
    headings.push({
      level: parseInt(match[1], 10),
      id: match[2],
      text: match[3].trim(),
    });
  }

  if (headings.length === 0) {
    const simpleRegex = /<h([12])[^>]*>([^<]*)<\/h[12]>/gi;
    let idx = 0;
    while ((match = simpleRegex.exec(renderedContent.value)) !== null) {
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || `heading-${idx}`;
      headings.push({ level: parseInt(match[1], 10), id, text });
      idx++;
    }
  }

  return headings;
});

const filteredPages = computed(() => {
  const q = query.value.trim().toLowerCase();
  const category = activeCategory.value;

  return pages.value.filter(p => {
    if (category && p.tags && !p.tags.includes(category)) {
      return false;
    }

    if (!q) return true;

    return (p.title || '').toLowerCase().includes(q);
  });
});

const paginatedResults = computed(() => {
  const items = searchResults.value.length > 0 ? searchResults.value : filteredPages.value;
  const start = (page.value - 1) * pageSize;
  return items.slice(start, start + pageSize);
});

const sortedPagesByDate = computed(() => {
  const parseTime = (v: string | null): number => Date.parse(v || '') || 0;

  return [...filteredPages.value].sort((a, b) => {
    const ta = parseTime(a.updated_at);
    const tb = parseTime(b.updated_at);
    if (ta !== tb) return ta - tb;
    if (a.order !== b.order) return Number(a.order || 0) - Number(b.order || 0);
    return String(a.slug).localeCompare(String(b.slug));
  });
});

const nextPage = computed<any | null>(() => {
  const slug = activeSlug.value;
  if (!slug) return null;
  const idx = sortedPagesByDate.value.findIndex(p => p.slug === slug);
  return idx < sortedPagesByDate.value.length - 1 ? sortedPagesByDate.value[idx + 1] : null;
});

const prevPage = computed<any | null>(() => {
  const slug = activeSlug.value;
  if (!slug) return null;
  const idx = sortedPagesByDate.value.findIndex(p => p.slug === slug);
  return idx > 0 ? sortedPagesByDate.value[idx - 1] : null;
});

const nav = ref<{ tag: string; pages: ArticleListItem[] }[]>([]);

const categories = computed(() => {
  return nav.value.map(n => n.tag);
});

const performSearch = async () => {
  const q = searchInput.value.trim();
  query.value = q;
  activeCategory.value = null;
  categoryTitle.value = '';
  activePage.value = null;
  page.value = 1;
  if (q) {
    try {
      console.log(`[Vue] Performing search for: ${q}`);
      const results = await articlesRegistry.search({ query: q, limit: 100 });
      searchResults.value = results.items;
      console.log(`[Vue] Search results:`, searchResults.value.length);
    } catch (err) {
      console.error('[Vue] Search failed:', err);
      searchResults.value = [];
    }
  } else {
    searchResults.value = [];
  }
};

const selectCategory = (category: string | null) => {
  activeCategory.value = category;
  query.value = '';
  searchInput.value = '';
  categoryTitle.value = category || '';
  activePage.value = null;
  page.value = 1;
};

const selectPage = async (slug: string) => {
  const id = String(slug || '').trim();
  if (!id) return;

  // Navigate to main knowledge base page with article slug
  router.push({ name: 'AgentKnowledgeBase', query: { article: id } });
};

onMounted(async () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {}

  loadingPages.value = true;
  try {
    // Load nav structure from registry
    nav.value = await articlesRegistry.getNavStructure();
    
    // Also load pages for other functionality
    const result = await articlesRegistry.search({ limit: 100 });
    pages.value = result.items;
  } catch (err) {
    console.error('Failed to load articles:', err);
  } finally {
    loadingPages.value = false;
  }

  // Check for URL parameters and handle accordingly
  const route = useRoute();
  const queryParam = route.query.q as string;
  const categoryParam = route.query.category as string;
  
  if (queryParam && queryParam.trim()) {
    searchInput.value = queryParam.trim();
    await performSearch();
  } else if (categoryParam && categoryParam.trim()) {
    // Handle category filtering
    activeCategory.value = categoryParam.trim();
    categoryTitle.value = categoryParam.trim();
  }
});

watch(() => query.value, () => {
  if (activeSlug.value) {
    const stillVisible = filteredPages.value.some(p => p.slug === activeSlug.value);
    if (!stillVisible) {
      activeSlug.value = null;
      activePage.value = null;
    }
  }
});

function toggleTheme() {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
}
</script>

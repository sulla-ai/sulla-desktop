<template>
  <div class="min-h-screen bg-white text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans"
    :class="{ dark: isDark }">
    <div class="flex min-h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex w-full flex-col">
        <div class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <div class="text-center">
              <h1 class="text-4xl font-bold text-slate-900 dark:text-white mb-4">
                Search Knowledge Base
              </h1>
              <p class="text-lg text-slate-600 dark:text-slate-400 mb-8">
                Find articles and memories in Sulla's knowledge base.
              </p>

              <!-- Search and category filters -->
              <div class="max-w-2xl mx-auto space-y-6">
                <div class="relative">
                  <svg aria-hidden="true" viewBox="0 0 20 20" class="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 fill-slate-400 dark:fill-slate-500">
                    <path d="M16.293 17.707a1 1 0 0 0 1.414-1.414l-1.414 1.414ZM9 14a5 5 0 0 1-5-5H2a7 7 0 0 0 7 7v-2ZM4 9a5 5 0 0 1 5-5V2a7 7 0 0 0-7 7h2Zm5-5a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7v2Zm8.707 12.293-3.757-3.757-1.414 1.414 3.757 3.757 1.414-1.414ZM14 9a4.98 4.98 0 0 1-1.464 3.536l1.414 1.414A6.98 6.98 0 0 0 16 9h-2Zm-1.464 3.536A4.98 4.98 0 0 1 9 14v2a6.98 6.98 0 0 0 4.95-2.05l-1.414-1.414Z"></path>
                  </svg>
                  <input
                    v-model="searchInput"
                    type="text"
                    placeholder="Search knowledge base"
                    class="h-12 w-full rounded-lg bg-white/95 pr-4 pl-12 text-base text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300/50 dark:bg-slate-800/75 dark:text-slate-100 dark:ring-white/5 dark:ring-inset"
                    @keydown.enter="performSearch"
                  >
                  <kbd class="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 font-medium text-slate-400 md:block dark:text-slate-500">
                    <kbd class="font-sans">⌘</kbd><kbd class="font-sans">K</kbd>
                  </kbd>
                </div>

                <div class="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    class="flex h-8 rounded-full p-px text-sm font-medium"
                    :class="activeCategory === null ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                    @click="selectCategory(null)"
                  >
                    <span class="flex items-center rounded-full px-3 py-1" :class="activeCategory === null ? 'bg-slate-800' : ''">All</span>
                  </button>
                  <button
                    v-for="category in categories"
                    :key="category"
                    type="button"
                    class="flex h-8 rounded-full p-px text-sm font-medium"
                    :class="activeCategory === category ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                    @click="selectCategory(category)"
                  >
                    <span class="flex items-center rounded-full px-3 py-1" :class="activeCategory === category ? 'bg-slate-800' : ''">{{ category }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main content area - full width blog-style layout -->
        <div class="max-w-4xl mx-auto px-4 py-16">
          <!-- Search results -->
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
              <p class="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">{{ article.excerpt }}</p>
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

          <!-- Category filtered results -->
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
              <p class="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">{{ article.excerpt }}</p>
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

          <!-- Default view - all articles -->
          <div v-else-if="!activePage" class="space-y-8">
            <div class="text-center mb-8">
              <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Latest Articles</h2>
              <p class="text-slate-600 dark:text-slate-400 mt-2">Explore knowledge and memories from Sulla's database</p>
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
              <p class="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">{{ article.excerpt }}</p>
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

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AgentHeader from './agent/AgentHeader.vue';
import { articlesRegistry } from '../agent/database/registry/ArticlesRegistry';
import { computed, onMounted, ref, watch } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import './assets/AgentKnowledgeBase.css';
import type { ArticleListItem, ArticleWithContent } from '../agent/database/registry/ArticlesRegistry';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);
const showOverlay = ref(true);  // ← new toggle state

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

  activeSlug.value = id;
  loadingPage.value = true;

  try {
    const article = await articlesRegistry.getBySlug(id);
    if (!article) {
      activePage.value = null;
      return;
    }

    activePage.value = article;
  } catch (err) {
    console.error('Failed to load article:', err);
    activePage.value = null;
  } finally {
    loadingPage.value = false;
  }
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

  if (!activeSlug.value && nav.value.length > 0 && nav.value[0].pages.length > 0) {
    await selectPage(nav.value[0].pages[0].slug);
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

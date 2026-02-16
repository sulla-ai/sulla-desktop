<template>
  <div class="min-h-screen bg-white text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans"
    :class="{ dark: isDark }">
    <PostHogTracker page-name="AgentKnowledgeBaseEdit" />
    <div class="flex min-h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex w-full flex-col">
        <div class="relative mx-auto flex w-full max-w-8xl flex-auto justify-center sm:px-2 lg:px-8 xl:px-12">
          <div class="hidden lg:relative lg:block lg:flex-none">
            <div class="absolute inset-y-0 right-0 w-[50vw] bg-slate-50 dark:hidden"></div>
            <div class="absolute top-16 right-0 bottom-0 hidden h-12 w-px bg-linear-to-t from-slate-800 dark:block"></div>
            <div class="absolute top-28 right-0 bottom-0 hidden w-px bg-slate-800 dark:block"></div>
            <div class="sticky top-19 -ml-0.5 h-[calc(100vh-4.75rem)] w-64 overflow-x-hidden overflow-y-auto py-16 pr-8 pl-0.5 xl:w-72 xl:pr-16">
              <nav class="text-base lg:text-sm">
                <ul role="list" class="space-y-9">
                  <li>
                    <h2 class="font-display font-medium text-slate-900 dark:text-white">Page Settings</h2>
                    <div class="mt-4 space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Title</label>
                        <input
                          v-model="pageTitle"
                          type="text"
                          placeholder="Enter page title..."
                          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Slug</label>
                        <input
                          v-model="pageSlug"
                          type="text"
                          disabled
                          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 cursor-not-allowed"
                        />
                        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Slug cannot be changed after creation</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Section</label>
                        <select
                          v-model="pageSection"
                          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="knowledgebase">Knowledge Base</option>
                          <option v-for="section in availableSections" :key="section.id" :value="section.id">
                            {{ section.name }}
                          </option>
                        </select>
                        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose the section for this article</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
                        <select
                          v-model="pageCategory"
                          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        >
                          <option v-for="category in availableCategories" :key="category.id" :value="category.id">
                            {{ category.name }}
                          </option>
                        </select>
                        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose the category within the selected section</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tags</label>
                        <input
                          v-model="pageTags"
                          type="text"
                          placeholder="sulla, memory, knowledge..."
                          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div class="pt-4 space-y-2">
                        <button
                          @click="previewPage"
                          class="w-full rounded-md bg-slate-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
                        >
                          Preview
                        </button>
                        <button
                          @click="savePage"
                          :disabled="saving"
                          class="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {{ saving ? 'Saving...' : 'Save Changes' }}
                        </button>
                      </div>
                      <div v-if="saveMessage" class="text-sm" :class="saveMessageError ? 'text-red-500' : 'text-green-500'">
                        {{ saveMessage }}
                      </div>
                      <div class="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                        <button
                          @click="showDeleteModal = true"
                          class="w-full rounded-md bg-red-600/10 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                        >
                          Delete Article
                        </button>
                      </div>
                    </div>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          <div class="max-w-2xl min-w-0 flex-auto px-4 py-16 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16">
            <article v-if="loading" class="py-16 text-center text-slate-500 dark:text-slate-400">
              Loading article...
            </article>
            <article v-else-if="loadError" class="py-16 text-center text-red-500">
              {{ loadError }}
            </article>
            <article v-else>
              <header class="mb-9 space-y-1">
                <p class="font-display text-sm font-medium text-sky-500">{{ pageCategory || 'Memory' }}</p>
                <input
                  v-model="pageTitle"
                  type="text"
                  placeholder="Edit Article"
                  class="font-display text-3xl tracking-tight text-slate-900 dark:text-white bg-transparent border-none outline-none w-full focus:ring-0 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </header>
              
              <!-- WYSIWYG Editor Area -->
              <div class="prose max-w-none prose-slate dark:text-slate-400 dark:prose-invert">
                <div class="bg-white dark:bg-slate-900 rounded-lg">
                  <!-- Editor Toolbar -->
                  <div class="border-b border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 flex items-center space-x-2 rounded-t-lg">
                    <button
                      v-for="tool in editorTools"
                      :key="tool.name"
                      @click="applyFormat(tool.command)"
                      :class="[
                        'px-2 py-1 text-sm rounded hover:bg-slate-200 dark:hover:bg-slate-700',
                        tool.active ? 'bg-slate-200 dark:bg-slate-700' : ''
                      ]"
                      :title="tool.title"
                    >
                      {{ tool.icon }}
                    </button>
                  </div>
                  
                  <!-- Editor Content -->
                  <div
                    ref="editorEl"
                    contenteditable="true"
                    @input="onEditorInput"
                    class="p-4 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-b-lg overflow-hidden resize-none"
                    placeholder="Start writing your knowledge base content here..."
                    style="min-height: auto; height: auto;"
                  ></div>
                </div>
              </div>

              <!-- Preview Area (shown when preview is active) -->
              <div v-if="showPreview" class="mt-8">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">Preview</h3>
                <div 
                  class="prose max-w-none prose-slate dark:text-slate-400 dark:prose-invert prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-34 prose-lead:text-slate-500 dark:prose-lead:text-slate-400 prose-a:font-semibold dark:prose-a:text-sky-400 dark:[--tw-prose-background:var(--color-slate-900)] prose-a:no-underline prose-a:shadow-[inset_0_-2px_0_0_var(--tw-prose-background,#fff),inset_0_calc(-1*(var(--tw-prose-underline-size,4px)+2px))_0_0_var(--tw-prose-underline,var(--color-sky-300))] prose-a:hover:[--tw-prose-underline-size:6px] dark:prose-a:shadow-[inset_0_calc(-1*var(--tw-prose-underline-size,2px))_0_0_var(--tw-prose-underline,var(--color-sky-800))] dark:prose-a:hover:[--tw-prose-underline-size:6px] prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:shadow-lg dark:prose-pre:bg-slate-800/60 dark:prose-pre:shadow-none dark:prose-pre:ring-1 dark:prose-pre:ring-slate-300/10 dark:prose-hr:border-slate-800"
                  v-html="renderedPreview"></div>
              </div>
            </article>
          </div>
          <div
            class="hidden xl:sticky xl:top-19 xl:-mr-6 xl:block xl:h-[calc(100vh-4.75rem)] xl:flex-none xl:overflow-y-auto xl:py-16 xl:pr-6">
            <nav aria-labelledby="relationships-title" class="w-56">
              <h2 id="relationships-title" class="font-display text-sm font-medium text-slate-900 dark:text-white">Relationships</h2>

              <!-- Mentions -->
              <div class="mt-4">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Mentions</h3>
                <div class="flex flex-wrap gap-1.5 mb-2">
                  <span
                    v-for="(mention, idx) in mentions"
                    :key="'m-' + idx"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300"
                  >
                    {{ mention }}
                    <button @click="removeMention(idx)" class="ml-0.5 hover:text-red-500 transition-colors" title="Remove">&times;</button>
                  </span>
                  <span v-if="mentions.length === 0" class="text-xs text-slate-400 dark:text-slate-500">None</span>
                </div>
                <div class="flex gap-1">
                  <input
                    v-model="newMention"
                    type="text"
                    placeholder="Add mention..."
                    class="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    @keydown.enter="addMention"
                  />
                  <button @click="addMention" class="px-2 py-1 text-xs rounded-md bg-sky-600 text-white hover:bg-sky-700">+</button>
                </div>
              </div>

              <!-- Related Entities -->
              <div class="mt-6">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Related Entities</h3>
                <div class="flex flex-wrap gap-1.5 mb-2">
                  <span
                    v-for="(entity, idx) in relatedEntities"
                    :key="'e-' + idx"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
                  >
                    {{ entity }}
                    <button @click="removeRelatedEntity(idx)" class="ml-0.5 hover:text-red-500 transition-colors" title="Remove">&times;</button>
                  </span>
                  <span v-if="relatedEntities.length === 0" class="text-xs text-slate-400 dark:text-slate-500">None</span>
                </div>
                <div class="flex gap-1">
                  <input
                    v-model="newRelatedEntity"
                    type="text"
                    placeholder="Add entity..."
                    class="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    @keydown.enter="addRelatedEntity"
                  />
                  <button @click="addRelatedEntity" class="px-2 py-1 text-xs rounded-md bg-purple-600 text-white hover:bg-purple-700">+</button>
                </div>
              </div>

              <!-- Related Slugs -->
              <div class="mt-6">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Related Articles</h3>
                <div class="flex flex-wrap gap-1.5 mb-2">
                  <span
                    v-for="(slug, idx) in relatedSlugs"
                    :key="'s-' + idx"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
                  >
                    {{ slug }}
                    <button @click="removeRelatedSlug(idx)" class="ml-0.5 hover:text-red-500 transition-colors" title="Remove">&times;</button>
                  </span>
                  <span v-if="relatedSlugs.length === 0" class="text-xs text-slate-400 dark:text-slate-500">None</span>
                </div>
                <div class="flex gap-1">
                  <input
                    v-model="newRelatedSlug"
                    type="text"
                    placeholder="Add article slug..."
                    class="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    @keydown.enter="addRelatedSlug"
                  />
                  <button @click="addRelatedSlug" class="px-2 py-1 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700">+</button>
                </div>
              </div>
            </nav>
          </div>
        </div>

      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center">
          <!-- Overlay -->
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeDeleteModal"></div>

          <!-- Modal -->
          <div class="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div class="px-6 pt-6 pb-4">
              <div class="flex items-center gap-3 mb-4">
                <div class="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-600 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Delete Article</h3>
                  <p class="text-sm text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
                </div>
              </div>

              <p class="text-sm text-slate-600 dark:text-slate-300 mb-4">
                You are about to permanently delete <strong class="text-slate-900 dark:text-white">{{ pageTitle }}</strong>. To confirm, type <code class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-red-600 dark:text-red-400 font-mono text-xs">delete</code> below.
              </p>

              <input
                v-model="deleteConfirmText"
                type="text"
                placeholder="Type delete to confirm"
                class="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-slate-700 dark:text-white placeholder:text-slate-400"
                @keydown.enter="confirmDelete"
              />
            </div>

            <div class="flex gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
              <button
                @click="closeDeleteModal"
                class="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                @click="confirmDelete"
                :disabled="deleteConfirmText.toLowerCase() !== 'delete' || deleting"
                class="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {{ deleting ? 'Deleting...' : 'Delete Article' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import AgentHeader from './agent/AgentHeader.vue';
import { onMounted, ref, watch, computed } from 'vue';
import PostHogTracker from '@pkg/components/PostHogTracker.vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { Article } from '../agent/database/models/Article';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();

const route = useRoute();

import './assets/AgentKnowledgeBase.css';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);

// Form data
const pageTitle = ref('');
const pageSection = ref('knowledgebase');
const pageCategory = ref('');
const pageTags = ref('');
const pageContent = ref('');
const pageSlug = ref('');

// Loading / saving state
const loading = ref(true);
const loadError = ref('');
const saving = ref(false);
const saveMessage = ref('');
const saveMessageError = ref(false);

// Delete state
const showDeleteModal = ref(false);
const deleteConfirmText = ref('');
const deleting = ref(false);

const closeDeleteModal = () => {
  showDeleteModal.value = false;
  deleteConfirmText.value = '';
};

const confirmDelete = async () => {
  if (deleteConfirmText.value.toLowerCase() !== 'delete') return;

  deleting.value = true;
  try {
    const article = await Article.find(pageSlug.value);
    if (article) {
      await article.delete();
    }
    closeDeleteModal();
    router.push('/KnowledgeBase');
  } catch (error) {
    console.error('Failed to delete article:', error);
    closeDeleteModal();
    saveMessage.value = `Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`;
    saveMessageError.value = true;
  } finally {
    deleting.value = false;
  }
};

// Available sections and categories from database
const availableSections = ref<Array<{id: string, name: string, description: string}>>([]);
const availableCategories = ref<Array<{id: string, name: string, description: string}>>([]);

// Editor state
const editorEl = ref<HTMLElement | null>(null);
const showPreview = ref(false);

// Relationship data
const mentions = ref<string[]>([]);
const relatedEntities = ref<string[]>([]);
const relatedSlugs = ref<string[]>([]);
const newMention = ref('');
const newRelatedEntity = ref('');
const newRelatedSlug = ref('');

const addMention = () => {
  const val = newMention.value.trim();
  if (val && !mentions.value.includes(val)) {
    mentions.value.push(val);
  }
  newMention.value = '';
};
const removeMention = (idx: number) => { mentions.value.splice(idx, 1); };

const addRelatedEntity = () => {
  const val = newRelatedEntity.value.trim();
  if (val && !relatedEntities.value.includes(val)) {
    relatedEntities.value.push(val);
  }
  newRelatedEntity.value = '';
};
const removeRelatedEntity = (idx: number) => { relatedEntities.value.splice(idx, 1); };

const addRelatedSlug = () => {
  const val = newRelatedSlug.value.trim();
  if (val && !relatedSlugs.value.includes(val)) {
    relatedSlugs.value.push(val);
  }
  newRelatedSlug.value = '';
};
const removeRelatedSlug = (idx: number) => { relatedSlugs.value.splice(idx, 1); };

// Editor toolbar configuration
const editorTools = ref([
  { name: 'bold', icon: 'B', command: 'bold', title: 'Bold', active: false },
  { name: 'italic', icon: 'I', command: 'italic', title: 'Italic', active: false },
  { name: 'heading', icon: 'H', command: 'formatBlock', value: 'h3', title: 'Heading', active: false },
  { name: 'link', icon: '🔗', command: 'createLink', title: 'Link', active: false },
  { name: 'code', icon: '</>', command: 'formatBlock', value: 'pre', title: 'Code Block', active: false },
  { name: 'list', icon: '•', command: 'insertUnorderedList', title: 'Bullet List', active: false },
  { name: 'numberedlist', icon: '1.', command: 'insertOrderedList', title: 'Numbered List', active: false },
]);

const renderedPreview = computed(() => {
  if (!pageContent.value) {
    return '<p class="text-slate-500">Start writing to see preview...</p>';
  }
  
  const html = marked(pageContent.value) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|gif|jpe?g|webp);base64,|\/|\.|#)/i,
  });
});

const onEditorInput = (event: Event) => {
  const target = event.target as HTMLElement;
  pageContent.value = target.innerText || '';
};

const applyFormat = (command: string) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  if (command === 'createLink') {
    const url = prompt('Enter URL:');
    if (url) {
      document.execCommand(command, false, url);
    }
  } else if (command === 'formatBlock') {
    const tool = editorTools.value.find(t => t.command === command);
    if (tool?.value) {
      document.execCommand(command, false, tool.value);
    }
  } else {
    document.execCommand(command, false);
  }
  
  // Update content after formatting
  if (editorEl.value) {
    pageContent.value = editorEl.value.innerText || '';
  }
};

const previewPage = () => {
  showPreview.value = !showPreview.value;
};

const loadArticle = async (slug: string) => {
  loading.value = true;
  loadError.value = '';

  try {
    const article = await Article.find(slug);
    if (!article) {
      loadError.value = `Article with slug "${slug}" not found.`;
      return;
    }

    pageSlug.value = article.attributes.slug || '';
    pageTitle.value = article.attributes.title || '';
    pageSection.value = article.attributes.section || 'knowledgebase';
    pageCategory.value = article.attributes.category || '';
    pageContent.value = article.attributes.document || '';

    const tags = article.attributes.tags;
    if (Array.isArray(tags)) {
      pageTags.value = tags.join(', ');
    } else if (typeof tags === 'string') {
      pageTags.value = tags;
    } else {
      pageTags.value = '';
    }

    // Load relationship data
    const rawMentions = article.attributes.mentions;
    if (Array.isArray(rawMentions)) {
      mentions.value = rawMentions;
    } else if (typeof rawMentions === 'string' && rawMentions) {
      mentions.value = rawMentions.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else {
      mentions.value = [];
    }

    const rawEntities = article.attributes.related_entities;
    if (Array.isArray(rawEntities)) {
      relatedEntities.value = rawEntities.map((e: any) => typeof e === 'string' ? e : e.name || e.id || '');
    } else if (typeof rawEntities === 'string' && rawEntities) {
      relatedEntities.value = rawEntities.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else {
      relatedEntities.value = [];
    }

    const rawSlugs = article.attributes.related_slugs;
    if (Array.isArray(rawSlugs)) {
      relatedSlugs.value = rawSlugs;
    } else if (typeof rawSlugs === 'string' && rawSlugs) {
      relatedSlugs.value = rawSlugs.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else {
      relatedSlugs.value = [];
    }

  } catch (err) {
    console.error('Failed to load article:', err);
    loadError.value = 'Failed to load article. Please try again.';
  } finally {
    loading.value = false;
  }
};

const savePage = async () => {
  if (!pageTitle.value.trim()) {
    saveMessage.value = 'Please enter a page title';
    saveMessageError.value = true;
    return;
  }
  
  if (!pageContent.value.trim()) {
    saveMessage.value = 'Please enter some content';
    saveMessageError.value = true;
    return;
  }

  saving.value = true;
  saveMessage.value = '';
  saveMessageError.value = false;

  try {
    await Article.create({
      section: pageSection.value,
      category: pageCategory.value,
      slug: pageSlug.value,
      title: pageTitle.value,
      tags: pageTags.value.split(',').map(tag => tag.trim()).filter(tag => tag),
      document: pageContent.value,
      mentions: mentions.value,
      related_entities: relatedEntities.value,
      related_slugs: relatedSlugs.value,
      updated_at: new Date().toISOString(),
    });

    saveMessage.value = 'Changes saved successfully!';
    saveMessageError.value = false;
  } catch (error) {
    console.error('Failed to save article:', error);

    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    saveMessage.value = `Failed to save: ${errorMessage}`;
    saveMessageError.value = true;
  } finally {
    saving.value = false;
  }
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
};

// Load sections and categories from database
const loadSectionsAndCategories = async () => {
  try {
    const { SectionsRegistry } = await import('../agent/database/registry/SectionsRegistry');
    const registry = SectionsRegistry.getInstance();

    availableSections.value = await registry.getSuggestedSections();
    availableCategories.value = await registry.getSuggestedCategories();

    if (availableCategories.value.length > 0 && !pageCategory.value) {
      pageCategory.value = availableCategories.value[0].id;
    }
  } catch (error) {
    console.error('Failed to load sections and categories:', error);
    availableCategories.value = [
      { id: 'documentation', name: 'Documentation', description: 'General documentation' },
      { id: 'tutorial', name: 'Tutorial', description: 'Step-by-step guides' },
      { id: 'reference', name: 'Reference', description: 'API and technical references' },
      { id: 'procedure', name: 'Procedure', description: 'Operational procedures' },
      { id: 'troubleshooting', name: 'Troubleshooting', description: 'Problem-solving guides' }
    ];
    if (!pageCategory.value) {
      pageCategory.value = 'documentation';
    }
  }
};

// Watch for section changes to update available categories
watch(pageSection, async (newSection) => {
  if (newSection && newSection !== 'knowledgebase') {
    try {
      const { SectionsRegistry } = await import('../agent/database/registry/SectionsRegistry');
      const registry = SectionsRegistry.getInstance();

      const sectionCategories = await registry.getCategoriesForSection(newSection);
      availableCategories.value = sectionCategories;

      if (pageCategory.value && !sectionCategories.some(cat => cat.id === pageCategory.value)) {
        pageCategory.value = sectionCategories.length > 0 ? sectionCategories[0].id : '';
      }
    } catch (error) {
      console.error('Failed to load categories for section:', error);
    }
  } else {
    await loadSectionsAndCategories();
  }
});

// When loading finishes, the editor DOM appears — populate it
watch(loading, async (newVal, oldVal) => {
  if (oldVal === true && newVal === false && pageContent.value) {
    await nextTick();
    if (editorEl.value) {
      editorEl.value.innerText = pageContent.value;
    }
  }
});

onMounted(async () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {
    isDark.value = false;
  }

  await loadSectionsAndCategories();

  const slug = route.params.slug as string;
  if (slug) {
    await loadArticle(slug);
  } else {
    loading.value = false;
    loadError.value = 'No article slug provided.';
  }
});
</script>

<style scoped>
/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
  opacity: 0;
}

/* Editor styles */
[contenteditable]:empty:before {
  content: attr(placeholder);
  color: #94a3b8;
}

[contenteditable] {
  min-height: auto !important;
  height: auto !important;
  resize: none !important;
  overflow: visible !important;
}

/* Prose styles for editor content */
.prose [contenteditable] {
  line-height: 1.75;
}

.prose [contenteditable] h1,
.prose [contenteditable] h2,
.prose [contenteditable] h3 {
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

.prose [contenteditable] p {
  margin-bottom: 1em;
}

.prose [contenteditable] pre {
  background-color: #1e293b;
  color: #e2e8f0;
  padding: 1em;
  border-radius: 0.5em;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  overflow-x: auto;
}

.prose [contenteditable] code {
  background-color: #f1f5f9;
  color: #0f172a;
  padding: 0.125em 0.25em;
  border-radius: 0.25em;
  font-size: 0.875em;
}

.dark .prose [contenteditable] code {
  background-color: #334155;
  color: #f1f5f9;
}

/* Dark mode scrollbars */
.dark ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.dark ::-webkit-scrollbar-track {
  background: #1e293b;
  border-radius: 4px;
}

.dark ::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

.dark ::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

.dark ::-webkit-scrollbar-corner {
  background: #1e293b;
}

.dark [contenteditable]::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.dark [contenteditable]::-webkit-scrollbar-track {
  background: #334155;
  border-radius: 3px;
}

.dark [contenteditable]::-webkit-scrollbar-thumb {
  background: #64748b;
  border-radius: 3px;
}

.dark [contenteditable]::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>

<template>
  <div class="min-h-screen bg-white text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans"
    :class="{ dark: isDark }">
    <PostHogTracker page-name="AgentKnowledgeBaseCreate" />
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
                          @input="updateSlug"
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
                          placeholder="page-url-slug"
                          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        />
                        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">URL-friendly identifier for the page</p>
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
                          @click="createPage"
                          class="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          Create Page
                        </button>
                      </div>
                    </div>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          <div class="max-w-2xl min-w-0 flex-auto px-4 py-16 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16">
            <article>
              <header class="mb-9 space-y-1">
                <p class="font-display text-sm font-medium text-sky-500">{{ pageCategory || 'Memory' }}</p>
                <h1 class="font-display text-3xl tracking-tight text-slate-900 dark:text-white">
                  {{ pageTitle || 'New KnowledgeBase Page' }}
                </h1>
              </header>
              
              <!-- WYSIWYG Editor Area -->
              <div class="prose max-w-none prose-slate dark:text-slate-400 dark:prose-invert">
                <div class="min-h-[400px] rounded-lg border border-slate-300 dark:border-slate-600">
                  <!-- Editor Toolbar -->
                  <div class="border-b border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 flex items-center space-x-2">
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
                    class="p-4 min-h-[350px] focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    placeholder="Start writing your knowledge base content here..."
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
            <nav aria-labelledby="on-this-page-title" class="w-56">
              <h2 id="on-this-page-title" class="font-display text-sm font-medium text-slate-900 dark:text-white">
                Writing Tips</h2>
              <ol role="list" class="mt-4 space-y-3 text-sm">
                <li class="text-slate-500 dark:text-slate-400">
                  • Use clear headings to structure your content
                </li>
                <li class="text-slate-500 dark:text-slate-400">
                  • Include code examples with proper formatting
                </li>
                <li class="text-slate-500 dark:text-slate-400">
                  • Add relevant tags for better discoverability
                </li>
                <li class="text-slate-500 dark:text-slate-400">
                  • Write in a clear, concise manner
                </li>
                <li class="text-slate-500 dark:text-slate-400">
                  • Use links to reference other knowledge base pages
                </li>
              </ol>
            </nav>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AgentHeader from './agent/AgentHeader.vue';
import PostHogTracker from '@pkg/components/PostHogTracker.vue';
import { onMounted, ref, watch, computed } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { Article } from '../agent/database/models/Article';
import { useRouter } from 'vue-router';

const router = useRouter();

import './assets/AgentKnowledgeBase.css';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);

const splashUrl = new URL('./assets/splash.png', import.meta.url).toString();
const splash2Url = new URL('./assets/splash2.png', import.meta.url).toString();

// Form data
const pageTitle = ref('');
const pageSection = ref('knowledgebase');
const pageCategory = ref('');
const pageTags = ref('');
const pageContent = ref('');
const pageSlug = ref('');

// Available sections and categories from database
const availableSections = ref<Array<{id: string, name: string, description: string}>>([]);
const availableCategories = ref<Array<{id: string, name: string, description: string}>>([]);

// Editor state
const editorEl = ref<HTMLElement | null>(null);
const showPreview = ref(false);

// Generate slug from title
const generateSlug = (title: string): string => {
  if (!title || !title.trim()) {
    return '';
  }
  
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove special characters except hyphens
    .slice(0, 50); // Limit length for better usability
};

// Update slug when title changes
const updateSlug = () => {
  if (pageTitle.value) {
    pageSlug.value = generateSlug(pageTitle.value);
  }
};

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
  
  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  
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

const createPage = async () => {
  if (!pageTitle.value.trim()) {
    alert('Please enter a page title');
    return;
  }
  
  if (!pageContent.value.trim()) {
    alert('Please enter some content');
    return;
  }

  if (!pageCategory.value) {
    alert('Please select a category');
    return;
  }

  // Auto-generate slug if empty
  if (!pageSlug.value.trim()) {
    pageSlug.value = generateSlug(pageTitle.value);
  }

  // Validate slug format
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(pageSlug.value)) {
    alert('Slug can only contain lowercase letters, numbers, and hyphens');
    return;
  }

  // Final check that slug exists after generation
  if (!pageSlug.value.trim()) {
    alert('Could not generate slug from title. Please enter a slug manually.');
    return;
  }
  
  try {
    // Check if slug already exists
    const existingArticle = await Article.find(pageSlug.value);
    if (existingArticle) {
      alert(`A page with slug "${pageSlug.value}" already exists. Please choose a different slug.`);
      return;
    }

    // Create article using Article model
    const article = await Article.create({
      section: pageSection.value,
      category: pageCategory.value,
      slug: pageSlug.value,
      title: pageTitle.value,
      tags: pageTags.value.split(',').map(tag => tag.trim()).filter(tag => tag),
      document: pageContent.value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    // Show success message
    alert('Page created successfully!');
    
    // Navigate back to KnowledgeBase
    router.push('/KnowledgeBase');
    pageTitle.value = '';
    pageSlug.value = '';
    pageContent.value = '';
    pageTags.value = '';
    pageSection.value = 'knowledgebase';
    pageCategory.value = '';
    if (editorEl.value) editorEl.value.innerHTML = '';
    
  } catch (error) {
    console.error('Failed to create page:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      if (error.message.includes('Missing required field')) {
        const fieldName = error.message.split("'")[1] || 'unknown';
        errorMessage = `Missing required field: ${fieldName}`;
      } else if (error.message.includes('slug')) {
        errorMessage = 'Invalid slug: ' + error.message;
      } else {
        errorMessage = error.message;
      }
    }
    
    alert(`Failed to create page: ${errorMessage}`);
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

    // Load suggested sections and categories
    availableSections.value = await registry.getSuggestedSections();
    availableCategories.value = await registry.getSuggestedCategories();

    // Set default category if available
    if (availableCategories.value.length > 0 && !pageCategory.value) {
      pageCategory.value = availableCategories.value[0].id;
    }
  } catch (error) {
    console.error('Failed to load sections and categories:', error);
    // Fallback to basic categories if database fails
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

      // Load categories for the selected section
      const sectionCategories = await registry.getCategoriesForSection(newSection);
      availableCategories.value = sectionCategories;

      // Reset category selection if it's not in the new section
      if (pageCategory.value && !sectionCategories.some(cat => cat.id === pageCategory.value)) {
        pageCategory.value = sectionCategories.length > 0 ? sectionCategories[0].id : '';
      }
    } catch (error) {
      console.error('Failed to load categories for section:', error);
    }
  } else {
    // For knowledgebase section, show all categories
    await loadSectionsAndCategories();
  }
});

onMounted(async () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {
    isDark.value = false;
  }

  // Load sections and categories
  await loadSectionsAndCategories();
});
</script>

<style scoped>
/* Editor styles */
[contenteditable]:empty:before {
  content: attr(placeholder);
  color: #94a3b8;
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

/* Dark mode scrollbars for specific elements */
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

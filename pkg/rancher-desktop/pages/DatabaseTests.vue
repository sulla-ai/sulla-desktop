<template>
  <div class="min-h-screen bg-white text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans">
    <div class="flex min-h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex w-full flex-col">
        <div class="relative mx-auto flex w-full max-w-8xl flex-auto justify-center sm:px-2 lg:px-8 xl:px-12">
          <div class="min-w-0 flex-auto px-4 py-16 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16">
            <article>
              <header class="mb-9 space-y-1">
                <h1 class="font-display text-3xl tracking-tight text-slate-900 dark:text-white">
                  Database Integration Tests
                </h1>
                <p class="text-slate-500 dark:text-slate-400">
                  Test Article and ArticlesRegistry classes with actual implementations
                </p>
              </header>

              <div class="space-y-6">
                <div class="flex gap-4">
                  <button
                    @click="runAllTests"
                    :disabled="isRunning"
                    class="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50"
                  >
                    {{ isRunning ? 'Running Tests...' : 'Run All Tests' }}
                  </button>
                  <button
                    @click="clearResults"
                    class="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700"
                  >
                    Clear Results
                  </button>
                </div>

                <div v-if="results.length > 0" class="space-y-2">
                  <h3 class="text-lg font-semibold">Test Results:</h3>
                  <div class="bg-slate-50 dark:bg-slate-800 rounded p-4 font-mono text-sm">
                    <div
                      v-for="(result, index) in results"
                      :key="index"
                      :class="[
                        'mb-2',
                        result.status === 'pass' ? 'text-green-600' :
                        result.status === 'fail' ? 'text-red-600' : 'text-blue-600'
                      ]"
                    >
                      {{ result.message }}
                    </div>
                  </div>
                </div>

                <div v-if="finalResult" class="p-4 rounded" :class="finalResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
                  <h3 class="font-semibold">{{ finalResult.success ? '✅ All Tests Passed!' : '❌ Tests Failed' }}</h3>
                  <p>{{ finalResult.message }}</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AgentHeader from './agent/AgentHeader.vue';
import { Article } from '../agent/database/models/Article';
import { ArticlesRegistry } from '../agent/database/registry/ArticlesRegistry';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);
const isRunning = ref(false);
const results = ref<Array<{status: 'pass' | 'fail' | 'info', message: string}>>([]);
const finalResult = ref<{success: boolean, message: string} | null>(null);

const testSlug = 'integration-test-' + Date.now();

function addResult(status: 'pass' | 'fail' | 'info', message: string) {
  results.value.push({ status, message });
}

async function runTest(testName: string, testFn: () => Promise<void>) {
  try {
    addResult('info', `🧪 Running ${testName}...`);
    await testFn();
    addResult('pass', `✅ ${testName} passed`);
  } catch (error) {
    addResult('fail', `❌ ${testName} failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function runAllTests() {
  if (isRunning.value) return;

  isRunning.value = true;
  results.value = [];
  finalResult.value = null;

  try {
    // Test 1: Article.create()
    await runTest('Article.create()', async () => {
      const article = await Article.create({
        section: 'knowledgebase',
        category: 'integration-test',
        slug: testSlug,
        title: 'Integration Test Article',
        tags: ['integration', 'test'],
        document: 'This is a test article created using Article.create() in the actual app context.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (!article) {
        throw new Error('Article.create() returned null');
      }
    });

    // Test 2: Article.find()
    await runTest('Article.find()', async () => {
      const found = await Article.find(testSlug);
      if (!found) {
        throw new Error('Article not found');
      }
      if (found.attributes.title !== 'Integration Test Article') {
        throw new Error('Article title mismatch');
      }
    });

    // Test 3: ArticlesRegistry.getInstance()
    await runTest('ArticlesRegistry.getInstance()', async () => {
      const registry = ArticlesRegistry.getInstance();
      if (!registry) {
        throw new Error('Registry instance is null');
      }
    });

    // Test 4: ArticlesRegistry.getBySlug()
    await runTest('ArticlesRegistry.getBySlug()', async () => {
      const registry = ArticlesRegistry.getInstance();
      const article = await registry.getBySlug(testSlug);
      if (!article) {
        throw new Error('Article not found via registry');
      }
      if (article.title !== 'Integration Test Article') {
        throw new Error('Article title mismatch in registry');
      }
    });

    // Test 5: ArticlesRegistry.search()
    await runTest('ArticlesRegistry.search()', async () => {
      const registry = ArticlesRegistry.getInstance();
      const results = await registry.search({ query: 'integration test' });
      if (results.items.length === 0) {
        throw new Error('Search returned no results');
      }
    });

    // Test 6: ArticlesRegistry.getCategories()
    await runTest('ArticlesRegistry.getCategories()', async () => {
      const registry = ArticlesRegistry.getInstance();
      const categories = await registry.getCategories();
      if (!Array.isArray(categories)) {
        throw new Error('getCategories did not return an array');
      }
    });

    // Test 7: ArticlesRegistry.getTags()
    await runTest('ArticlesRegistry.getTags()', async () => {
      const registry = ArticlesRegistry.getInstance();
      const tags = await registry.getTags();
      if (!Array.isArray(tags)) {
        throw new Error('getTags did not return an array');
      }
    });

    // Test 8: ArticlesRegistry.saveArticle()
    await runTest('ArticlesRegistry.saveArticle()', async () => {
      const registry = ArticlesRegistry.getInstance();
      const saveSlug = testSlug + '-saved';
      await registry.saveArticle({
        slug: saveSlug,
        title: 'Saved via Registry',
        category: 'integration-test',
        tags: ['saved', 'registry'],
        document: 'Article saved using ArticlesRegistry.saveArticle()'
      });

      // Verify it was saved
      const saved = await Article.find(saveSlug);
      if (!saved) {
        throw new Error('Saved article not found');
      }

      // Clean up
      await registry.deleteArticle(saveSlug);
    });

    // Test 9: ArticlesRegistry.deleteArticle()
    await runTest('ArticlesRegistry.deleteArticle()', async () => {
      const registry = ArticlesRegistry.getInstance();
      const result = await registry.deleteArticle(testSlug);
      if (!result) {
        throw new Error('deleteArticle returned false');
      }

      // Verify deletion
      const deleted = await Article.find(testSlug);
      if (deleted) {
        throw new Error('Article still exists after deletion');
      }
    });

    finalResult.value = {
      success: true,
      message: 'All integration tests passed! Article and ArticlesRegistry classes work correctly with their actual implementations.'
    };

  } catch (error) {
    finalResult.value = {
      success: false,
      message: `Tests failed: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    isRunning.value = false;
  }
}

function clearResults() {
  results.value = [];
  finalResult.value = null;
}

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
};

// Initialize theme
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {
    isDark.value = false;
  }
}
</script>

<style scoped>
/* Add any additional styles if needed */
</style>

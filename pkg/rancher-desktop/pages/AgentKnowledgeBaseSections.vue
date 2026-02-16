<template>
  <div class="min-h-screen bg-white text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans"
    :class="{ dark: isDark }">
    <PostHogTracker page-name="AgentKnowledgeBaseSections" />
    <div class="flex min-h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex w-full flex-col">
        <div class="overflow-hidden bg-slate-900 dark:-mt-19 dark:-mb-32 dark:pt-19 dark:pb-32">
          <div class="py-16 sm:px-2 lg:relative lg:px-0 lg:py-20">
            <div class="mx-auto grid max-w-2xl grid-cols-1 items-center gap-x-8 gap-y-16 px-4 lg:max-w-8xl lg:grid-cols-2 lg:px-8 xl:gap-x-16 xl:px-12">
              <div class="relative z-10 md:text-center lg:text-left">
                <img alt="" width="530" height="530" decoding="async" data-nimg="1"
                  class="absolute right-full bottom-full -mr-72 -mb-56 opacity-50" style="color:transparent"
                  :src="splashUrl">
                <div class="relative">
                  <p
                    class="inline bg-linear-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-5xl tracking-tight text-transparent">
                    KnowledgeBase Sections.</p>
                  <p class="mt-3 text-2xl tracking-tight text-slate-400">
                    Organize and manage your knowledge structure with sections and categories.
                  </p>
                  <div class="mt-8 flex gap-4 md:justify-center lg:justify-start">
                    <button
                      class="text-sm font-semibold rounded-full bg-sky-300 py-2 px-4 text-sm font-semibold text-slate-900 hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/50 active:bg-sky-500"
                      @click="showAddSectionDialog = true"
                    >
                      Add Section
                    </button>
                    <router-link
                      to="/KnowledgeBase"
                      class="rounded-full bg-slate-800 py-2 px-4 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 active:text-slate-400"
                    >
                      Back to KnowledgeBase
                    </router-link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="relative mx-auto flex w-full max-w-8xl flex-auto justify-center sm:px-2 lg:px-8 xl:px-12">
          <div class="max-w-2xl min-w-0 flex-auto px-4 py-16 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16">
            <div class="space-y-8">
              <!-- Sections Overview -->
              <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-4">Sections & Categories Structure</h2>
                <p class="text-slate-600 dark:text-slate-400 mb-6">
                  Manage your knowledge base organization. Sections group related categories, and categories organize your articles.
                </p>

                <!-- Loading State -->
                <div v-if="loading" class="text-center py-8">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mx-auto"></div>
                  <p class="mt-2 text-slate-500 dark:text-slate-400">Loading sections...</p>
                </div>

                <!-- Sections List -->
                <div v-else-if="sections.length > 0" class="space-y-6">
                  <div v-for="section in sections" :key="section.id" class="border border-slate-200 dark:border-slate-600 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-3">
                      <h3 class="text-lg font-medium text-slate-900 dark:text-white">{{ section.name }}</h3>
                      <div class="flex gap-2">
                        <button
                          class="text-xs px-3 py-1 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 rounded hover:bg-sky-200 dark:hover:bg-sky-800"
                          @click="editSection(section)"
                        >
                          Edit
                        </button>
                        <button
                          class="text-xs px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800"
                          @click="deleteSection(section)"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div class="text-sm text-slate-600 dark:text-slate-400 mb-3">{{ section.description }}</div>

                    <!-- Categories in this section -->
                    <div class="ml-4">
                      <h4 class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Categories:</h4>
                      <div class="flex flex-wrap gap-2">
                        <span
                          v-for="category in section.categories"
                          :key="category.id"
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                        >
                          {{ category.name }}
                          <button
                            class="ml-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            @click="removeCategoryFromSection(section.id, category.id)"
                          >
                            ×
                          </button>
                        </span>
                        <button
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-800"
                          @click="addCategoryToSection(section)"
                        >
                          + Add Category
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Empty State -->
                <div v-else class="text-center py-8">
                  <p class="text-slate-500 dark:text-slate-400 mb-4">No sections created yet.</p>
                  <button
                    class="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    @click="showAddSectionDialog = true"
                  >
                    Create Your First Section
                  </button>
                </div>
              </div>

              <!-- Orphaned Categories -->
              <div v-if="orphanedCategories.length > 0" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
                <h3 class="text-lg font-medium text-amber-800 dark:text-amber-200 mb-2">Orphaned Categories</h3>
                <p class="text-amber-700 dark:text-amber-300 text-sm mb-4">
                  These categories exist but are not assigned to any section. Consider adding them to a section or creating a new section for them.
                </p>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="category in orphanedCategories"
                    :key="category.id"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-200"
                  >
                    {{ category.name }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Section Dialog -->
    <div v-if="showAddSectionDialog || editingSection" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-4">
          {{ editingSection ? 'Edit Section' : 'Add New Section' }}
        </h3>

        <form @submit.prevent="saveSection">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Section Name</label>
              <input
                v-model="sectionForm.name"
                type="text"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                required
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                v-model="sectionForm.description"
                rows="3"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              ></textarea>
            </div>
          </div>

          <div class="flex gap-3 mt-6">
            <button
              type="button"
              class="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
              @click="cancelSectionEdit"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex-1 px-4 py-2 bg-sky-500 text-white rounded-md hover:bg-sky-600 disabled:opacity-50"
              :disabled="!sectionForm.name.trim()"
            >
              {{ editingSection ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Category Dialog -->
    <div v-if="showAddCategoryDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-4">
          Add Category to "{{ selectedSectionForCategory?.name }}"
        </h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category Name</label>
            <input
              v-model="categoryForm.name"
              type="text"
              class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              required
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description (Optional)</label>
            <textarea
              v-model="categoryForm.description"
              rows="2"
              class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            ></textarea>
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <button
            type="button"
            class="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
            @click="showAddCategoryDialog = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="flex-1 px-4 py-2 bg-sky-500 text-white rounded-md hover:bg-sky-600 disabled:opacity-50"
            :disabled="!categoryForm.name.trim()"
            @click="saveCategory"
          >
            Add Category
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AgentHeader from './agent/AgentHeader.vue';
import { onMounted, ref, computed } from 'vue';
import PostHogTracker from '@pkg/components/PostHogTracker.vue';
const isDark = ref(false);

const splashUrl = new URL('./assets/splash.png', import.meta.url).toString();

const loading = ref(false);
const sections = ref<any[]>([]);
const orphanedCategories = ref<any[]>([]);

// Dialog states
const showAddSectionDialog = ref(false);
const editingSection = ref<any>(null);
const showAddCategoryDialog = ref(false);
const selectedSectionForCategory = ref<any>(null);

// Forms
const sectionForm = ref({
  name: '',
  description: ''
});

const categoryForm = ref({
  name: '',
  description: ''
});

// Theme handling
onMounted(async () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {}

  await loadSections();
});

function toggleTheme() {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
}

// Section management
async function loadSections() {
  loading.value = true;
  try {
    const { SectionsRegistry } = await import('../agent/database/registry/SectionsRegistry');
    const registry = SectionsRegistry.getInstance();

    sections.value = await registry.getSectionsWithCategories();
    orphanedCategories.value = await registry.getOrphanedCategories();
    
    console.log('Loaded sections:', sections.value);
    console.log('Loaded orphaned categories:', orphanedCategories.value);
  } catch (error) {
    console.error('Failed to load sections:', error);
  } finally {
    loading.value = false;
  }
}

function editSection(section: any) {
  editingSection.value = section;
  sectionForm.value = {
    name: section.name,
    description: section.description
  };
}

function cancelSectionEdit() {
  showAddSectionDialog.value = false;
  editingSection.value = null;
  sectionForm.value = { name: '', description: '' };
}

async function saveSection() {
  if (!sectionForm.value.name.trim()) return;

  try {
    const { SectionsRegistry } = await import('../agent/database/registry/SectionsRegistry');
    const registry = SectionsRegistry.getInstance();

    if (editingSection.value) {
      // Update existing section
      const success = await registry.updateSection(editingSection.value.id, {
        name: sectionForm.value.name,
        description: sectionForm.value.description
      });

      if (!success) {
        throw new Error('Failed to update section');
      }
    } else {
      // Create new section
      const section = await registry.createSection({
        name: sectionForm.value.name,
        description: sectionForm.value.description
      });

      if (!section) {
        throw new Error('Failed to create section');
      }
    }

    await loadSections();
    cancelSectionEdit();
  } catch (error) {
    console.error('Failed to save section:', error);
    alert('Failed to save section: ' + (error as Error).message);
  }
}

async function deleteSection(section: any) {
  if (!confirm(`Delete section "${section.name}" and all its categories?`)) return;

  try {
    const { SectionsRegistry } = await import('../agent/database/registry/SectionsRegistry');
    const registry = SectionsRegistry.getInstance();

    const success = await registry.deleteSection(section.id);
    if (!success) {
      throw new Error('Failed to delete section');
    }

    await loadSections();
  } catch (error) {
    console.error('Failed to delete section:', error);
    alert('Failed to delete section: ' + (error as Error).message);
  }
}

function addCategoryToSection(section: any) {
  selectedSectionForCategory.value = section;
  showAddCategoryDialog.value = true;
  categoryForm.value = { name: '', description: '' };
}

async function saveCategory() {
  if (!categoryForm.value.name.trim() || !selectedSectionForCategory.value) return;

  try {
    const { SectionsRegistry } = await import('../agent/database/registry/SectionsRegistry');
    const registry = SectionsRegistry.getInstance();

    const category = await registry.createCategory({
      name: categoryForm.value.name,
      description: categoryForm.value.description,
      section_id: selectedSectionForCategory.value.id
    });

    if (!category) {
      throw new Error('Failed to create category');
    }

    showAddCategoryDialog.value = false;
    await loadSections();
  } catch (error) {
    console.error('Failed to save category:', error);
    alert('Failed to save category: ' + (error as Error).message);
  }
}

async function removeCategoryFromSection(sectionId: string, categoryId: string) {
  try {
    const { SectionsRegistry } = await import('../agent/database/registry/SectionsRegistry');
    const registry = SectionsRegistry.getInstance();

    const success = await registry.assignCategoryToSection(categoryId, null);
    if (!success) {
      throw new Error('Failed to remove category from section');
    }

    await loadSections();
  } catch (error) {
    console.error('Failed to remove category from section:', error);
    alert('Failed to remove category from section: ' + (error as Error).message);
  }
}
</script>

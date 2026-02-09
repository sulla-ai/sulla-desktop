// SectionsRegistry.ts - Cleaned & model-only

import { Section } from '../models/Section';
import { Category } from '../models/Category';

interface SectionWithCategories {
  id: string;
  name: string;
  description: string;
  categories: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  order: string;
  created_at: string;
  updated_at: string;
}

interface CategoryInfo {
  id: string;
  name: string;
  description: string;
}

export class SectionsRegistry {
  private static instance: SectionsRegistry | null = null;

  static getInstance(): SectionsRegistry {
    return this.instance ?? (this.instance = new SectionsRegistry());
  }

  private constructor() {}

  // Section management
  async createSection(attributes: {
    name: string;
    description?: string;
    order?: string;
  }): Promise<Section | null> {
    try {
      const sectionId = Section.generateId();
      const section = new Section();
      section.fill({ id: sectionId, ...attributes });
      await section.save();
      return section;
    } catch (error) {
      console.error('Failed to create section:', error);
      return null;
    }
  }

  async getSection(id: string): Promise<Section | null> {
    return Section.find(id);
  }

  async getAllSections(): Promise<Section[]> {
    return Section.all();
  }

  async updateSection(id: string, attrs: {
    name?: string;
    description?: string;
    order?: string;
  }): Promise<boolean> {
    const section = await Section.find(id);
    if (!section) return false;

    section.fill(attrs);
    await section.save();
    return true;
  }

  async deleteSection(id: string): Promise<boolean> {
    const section = await Section.find(id);
    if (!section) return false;

    // Reassign categories to null section
    const cats = await Category.getBySection(id);
    await Promise.all(cats.map(cat => cat.updateSection(null)));

    await section.delete();
    return true;
  }

  // Category management
  async createCategory(attributes: {
    name: string;
    description?: string;
    section_id?: string | null;
    order?: string;
  }): Promise<Category | null> {
    try {
      const categoryId = Category.generateId();
      const category = new Category();
      category.fill({ id: categoryId, ...attributes });
      await category.save();
      return category;
    } catch (error) {
      console.error('Failed to create category:', error);
      return null;
    }
  }

  async getCategory(id: string): Promise<Category | null> {
    return Category.find(id);
  }

  async getAllCategories(): Promise<Category[]> {
    return Category.all();
  }

  async getCategoriesBySection(sectionId: string): Promise<Category[]> {
    const categories = await Category.getBySection(sectionId);
    categories.forEach(cat => {
      console.log(`[SectionsRegistry] Category: ${cat.attributes.name} (ID: ${cat.attributes.id}, section_id: ${cat.attributes.section_id})`);
    });
    return categories;
  }

  async getOrphanedCategories(): Promise<Category[]> {
    return Category.getOrphaned();
  }

  async updateCategory(id: string, attrs: {
    name?: string;
    description?: string;
    section_id?: string | null;
    order?: string;
  }): Promise<boolean> {
    const category = await Category.find(id);
    if (!category) return false;

    category.fill(attrs);
    await category.save();
    return true;
  }

  async assignCategoryToSection(categoryId: string, sectionId: string | null): Promise<boolean> {
    const category = await Category.find(categoryId);
    if (!category) return false;

    await category.updateSection(sectionId);
    return true;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const category = await Category.find(id);
    if (!category) return false;

    await category.delete();
    return true;
  }

  // Combined views
  async getSectionsWithCategories(): Promise<SectionWithCategories[]> {
    const sections = await this.getAllSections();
    sections.forEach((section, index) => {
      console.log(`[SectionsRegistry] Section ${index}:`, {
        id: section.attributes.id,
        name: section.attributes.name,
        attributes: section.attributes
      });
    });

    const result: SectionWithCategories[] = [];

    for (const section of sections) {
      const id = section.attributes.id;
      if (!id) {
        continue;
      }

      const categories = await this.getCategoriesBySection(id);
      result.push({
        id,
        name: section.attributes.name || '',
        description: section.attributes.description || '',
        categories: categories.map(cat => ({
          id: cat.attributes.id || '',
          name: cat.attributes.name || '',
          description: cat.attributes.description || ''
        })),
        order: section.attributes.order || '100',
        created_at: section.attributes.created_at || '',
        updated_at: section.attributes.updated_at || ''
      });
    }

    return result.sort((a, b) => Number(a.order) - Number(b.order));
  }

  async getAllCategoriesInfo(): Promise<CategoryInfo[]> {
    const categories = await this.getAllCategories();
    return categories.map(cat => ({
      id: cat.attributes.id || '',
      name: cat.attributes.name || '',
      description: cat.attributes.description || ''
    }));
  }

  // Suggestions for UI/article creation
  async getSuggestedSections(): Promise<Array<{id: string, name: string, description: string}>> {
    const sections = await this.getAllSections();
    return sections.map(s => ({
      id: s.attributes.id || '',
      name: s.attributes.name || '',
      description: s.attributes.description || ''
    }));
  }

  async getSuggestedCategories(): Promise<Array<{id: string, name: string, description: string}>> {
    const categories = await this.getAllCategories();
    return categories.map(c => ({
      id: c.attributes.id || '',
      name: c.attributes.name || '',
      description: c.attributes.description || ''
    }));
  }

  async getCategoriesForSection(sectionId: string): Promise<Array<{id: string, name: string, description: string}>> {
    const categories = await this.getCategoriesBySection(sectionId);
    return categories.map(c => ({
      id: c.attributes.id || '',
      name: c.attributes.name || '',
      description: c.attributes.description || ''
    }));
  }
}

export const sectionsRegistry = SectionsRegistry.getInstance();
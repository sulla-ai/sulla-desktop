import { BaseModel } from '../BaseModel';

interface CategoryAttributes {
  id: string;
  name: string;
  description: string;
  section_id: string | null;
  order: string;
  created_at: string;
  updated_at: string;
}

export class Category extends BaseModel<CategoryAttributes> {
  protected tableName = 'knowledgebase_categories';
  protected primaryKey = 'id';
  protected fillable = [
    'id',
    'name',
    'description',
    'section_id',
    'order',
  ];

  // Generate a unique ID for the category
  static generateId(): string {
    return `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get categories by section
  static async getBySection(sectionId: string): Promise<Category[]> {
    return await this.where({ section_id: sectionId });
  }

  // Get orphaned categories (not assigned to any section)
  static async getOrphaned(): Promise<Category[]> {
    return await this.where('section_id IS NULL');
  }

  // Update category section
  async updateSection(sectionId: string | null): Promise<boolean> {
    this.attributes.section_id = sectionId;
    this.attributes.updated_at = new Date().toISOString();
    await this.save();
    return true;
  }

  // Delete this category
  async delete(): Promise<boolean> {
    return await super.delete();
  }
}

import { BaseModel } from '../BaseModel';

interface SectionAttributes {
  id: string;
  name: string;
  description: string;
  order: string;
  created_at: string;
  updated_at: string;
}

export class Section extends BaseModel<SectionAttributes> {
  protected tableName = 'knowledgebase_sections';
  protected primaryKey = 'id';
  protected fillable = [
    'id',
    'name',
    'description',
    'order',
  ];

  constructor(attributes: Partial<SectionAttributes> = {}) {
    console.log('[Section] Constructor called with:', attributes);
    super();
    this.attributes = { ...attributes };
    this.original = { ...attributes };
    console.log('[Section] After manual setup, attributes:', this.attributes);
    console.log('[Section] After manual setup, original:', this.original);
  }

  // Generate a unique ID for the section
  static generateId(): string {
    return `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Delete this section
  async delete(): Promise<boolean> {
    return await super.delete();
  }
}

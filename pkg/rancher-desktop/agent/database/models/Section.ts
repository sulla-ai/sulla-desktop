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

  // Generate a unique ID for the section
  static generateId(): string {
    return `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Delete this section
  async delete(): Promise<boolean> {
    return await super.delete();
  }
}

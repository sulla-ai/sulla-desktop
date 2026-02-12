import { VectorBaseModel } from '../VectorBaseModel';

export class DatabaseMigrations {
  private static instance: DatabaseMigrations;
  private vectorDB = VectorBaseModel.vectorDB;

  private constructor() {
    // Use the shared vectorDB instance
  }

  static getInstance(): DatabaseMigrations {
    if (!DatabaseMigrations.instance) {
      DatabaseMigrations.instance = new DatabaseMigrations();
    }
    return DatabaseMigrations.instance;
  }

  /**
   * Run all database migrations
   */
  async runMigrations(): Promise<void> {
    console.log('[Database Migrations] Starting migrations...');

    try {
      // Migration 001: Create sections and categories collections
      await this.migration001CreateSectionsAndCategories();

      console.log('[Database Migrations] All migrations completed successfully');
    } catch (error) {
      console.error('[Database Migrations] Migration failed:', error);
      throw error;
    }
  }

  /**
   * Migration 001: Create sections and categories collections
   * Creates the knowledgebase_sections and knowledgebase_categories collections
   */
  private async migration001CreateSectionsAndCategories(): Promise<void> {
    console.log('[Migration 001] Creating sections and categories collections...');

    try {
      // Get or create sections collection
      const sectionsCollection = await this.vectorDB.getOrCreateCollection('knowledgebase_sections');
      console.log('[Migration 001] Sections collection ready:', sectionsCollection.name);

      // Get or create categories collection
      const categoriesCollection = await this.vectorDB.getOrCreateCollection('knowledgebase_categories');
      console.log('[Migration 001] Categories collection ready:', categoriesCollection.name);

      console.log('[Migration 001] Collections created successfully');
    } catch (error) {
      console.error('[Migration 001] Failed to create collections:', error);
      throw error;
    }
  }

  /**
   * Initialize default sections and categories
   */
  async initializeDefaultData(): Promise<void> {
    console.log('[Database Init] Initializing default sections and categories...');

    try {
      const { SectionsRegistry } = await import('../registry/SectionsRegistry');
      const registry = SectionsRegistry.getInstance();

      // Check if we already have sections
      const existingSections = await registry.getAllSections();
      if (existingSections.length > 0) {
        console.log('[Database Init] Default data already exists, skipping initialization');
        return;
      }

      // Create default sections
      const defaultSections = [
        {
          name: 'Documentation',
          description: 'General documentation and guides',
        },
        {
          name: 'Tutorials',
          description: 'Step-by-step learning guides',
        },
        {
          name: 'Reference',
          description: 'API documentation and technical references',
        },
        {
          name: 'Procedures',
          description: 'Operational procedures and workflows',
        },
        {
          name: 'Troubleshooting',
          description: 'Problem-solving guides and solutions',
        }
      ];

      for (const sectionData of defaultSections) {
        const section = await registry.createSection(sectionData);
        if (section) {
          console.log(`[Database Init] Created section: ${sectionData.name}`);

          // Create default categories for each section
          const defaultCategories = this.getDefaultCategoriesForSection(sectionData.name);
          for (const categoryData of defaultCategories) {
            await registry.createCategory({
              ...categoryData,
              section_id: section.attributes.id,
            });
          }
          console.log(`[Database Init] Created ${defaultCategories.length} categories for section: ${sectionData.name}`);
        }
      }

      console.log('[Database Init] Default data initialization completed');
    } catch (error) {
      console.error('[Database Init] Failed to initialize default data:', error);
      throw error;
    }
  }

  /**
   * Get default categories for a section
   */
  private getDefaultCategoriesForSection(sectionName: string): Array<{name: string, description: string}> {
    const categoryMap: Record<string, Array<{name: string, description: string}>> = {
      'Documentation': [
        { name: 'Getting Started', description: 'Introduction and setup guides' },
        { name: 'Configuration', description: 'Configuration and settings' },
        { name: 'Best Practices', description: 'Recommended practices and patterns' },
      ],
      'Tutorials': [
        { name: 'Beginner', description: 'Basic tutorials for newcomers' },
        { name: 'Intermediate', description: 'Medium-complexity tutorials' },
        { name: 'Advanced', description: 'Complex tutorials for experienced users' },
      ],
      'Reference': [
        { name: 'API', description: 'API documentation and endpoints' },
        { name: 'CLI', description: 'Command-line interface reference' },
        { name: 'SDK', description: 'Software development kit documentation' },
      ],
      'Procedures': [
        { name: 'Deployment', description: 'Deployment and release procedures' },
        { name: 'Maintenance', description: 'Maintenance and monitoring procedures' },
        { name: 'Backup', description: 'Backup and recovery procedures' },
      ],
      'Troubleshooting': [
        { name: 'Common Issues', description: 'Frequently encountered problems' },
        { name: 'Debugging', description: 'Debugging techniques and tools' },
        { name: 'Support', description: 'Getting help and support resources' },
      ],
    };

    return categoryMap[sectionName] || [];
  }
}

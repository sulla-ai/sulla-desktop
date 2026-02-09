// KnowledgeBaseSectionsSeeder.ts
// Seeds the knowledge base with sections and categories
// This creates the organizational structure for the knowledge base

import { postgresClient } from '@pkg/agent/database/PostgresClient';

// Knowledge base sections data
const sectionsData = [
  {
    name: 'Getting Started',
    description: 'Essential guides for new users to get up and running',
    categories: [
      { name: 'Installation', description: 'How to install and set up the application' },
      { name: 'First Steps', description: 'Your first interactions and basic workflows' },
      { name: 'Configuration', description: 'Basic configuration and settings' }
    ]
  },
  {
    name: 'User Guide',
    description: 'Comprehensive guides for using all features',
    categories: [
      { name: 'Interface Overview', description: 'Understanding the main interface and navigation' },
      { name: 'Workflows', description: 'Step-by-step guides for common tasks' },
      { name: 'Advanced Features', description: 'Advanced functionality and power user tips' }
    ]
  },
  {
    name: 'Troubleshooting',
    description: 'Solutions to common problems and issues',
    categories: [
      { name: 'Common Errors', description: 'Frequently encountered error messages and fixes' },
      { name: 'Performance Issues', description: 'Optimizing performance and resolving slowdowns' },
      { name: 'Connectivity', description: 'Network and connection-related problems' }
    ]
  },
  {
    name: 'API Reference',
    description: 'Technical documentation for developers',
    categories: [
      { name: 'REST API', description: 'RESTful API endpoints and usage' },
      { name: 'WebSocket API', description: 'Real-time communication via WebSockets' },
      { name: 'SDKs', description: 'Software development kits and libraries' }
    ]
  },
  {
    name: 'Best Practices',
    description: 'Recommended approaches and optimization tips',
    categories: [
      { name: 'Security', description: 'Security best practices and recommendations' },
      { name: 'Performance', description: 'Performance optimization techniques' },
      { name: 'Maintenance', description: 'System maintenance and monitoring' }
    ]
  }
];

export async function initialize(): Promise<void> {
  console.log('[KB Sections Seeder] === STARTING SEEDER ===');
  console.log('[KB Sections Seeder] Starting knowledge base sections seeding...');

  try {
    const { SectionsRegistry } = await import('../registry/SectionsRegistry');
    const registry = SectionsRegistry.getInstance();

    // Check if we've already successfully seeded by looking for a specific section
    console.log('[KB Sections Seeder] Checking for existing sections...');
    const existingSections = await registry.getAllSections();
    console.log(`[KB Sections Seeder] Found ${existingSections.length} existing sections`);
    existingSections.forEach(section => {
      console.log(`[KB Sections Seeder] Existing section: "${section.attributes.name}" (ID: ${section.attributes.id})`);
    });

    // Clean up all existing sections and categories before recreating
    if (existingSections.length > 0) {
      console.log(`[KB Sections Seeder] Cleaning up ${existingSections.length} existing sections and their categories...`);
      for (const section of existingSections) {
        if (section.attributes.id) {
          console.log(`[KB Sections Seeder] Deleting section: ${section.attributes.name} (ID: ${section.attributes.id})`);
          await registry.deleteSection(section.attributes.id);
          console.log(`[KB Sections Seeder] Deleted section: ${section.attributes.name}`);
        }
      }
    }

    console.log('[KB Sections Seeder] Creating knowledge base sections and categories...');

    // Clean up any orphaned sections (sections without the expected structure)
    // This handles cases where previous seeding attempts created incomplete data
    console.log('[KB Sections Seeder] Checking for orphaned sections...');
    const expectedSectionNames = sectionsData.map(s => s.name);
    console.log('[KB Sections Seeder] Expected section names:', expectedSectionNames);
    // Since we just deleted all sections, there shouldn't be any orphaned ones, but check anyway
    const finalSectionsCheck = await registry.getAllSections();
    const orphanedSections = finalSectionsCheck.filter(s => !expectedSectionNames.includes(s.attributes.name || ''));
    console.log(`[KB Sections Seeder] Found ${orphanedSections.length} orphaned sections`);

    if (orphanedSections.length > 0) {
      console.log(`[KB Sections Seeder] Cleaning up ${orphanedSections.length} orphaned sections`);
      for (const section of orphanedSections) {
        if (section.attributes.id) {
          console.log(`[KB Sections Seeder] Deleting orphaned section: ${section.attributes.name} (ID: ${section.attributes.id})`);
          await registry.deleteSection(section.attributes.id);
          console.log(`[KB Sections Seeder] Deleted orphaned section: ${section.attributes.name}`);
        }
      }
    }

    // Create each section and its categories
    console.log(`[KB Sections Seeder] Processing ${sectionsData.length} sections...`);
    for (const sectionData of sectionsData) {
      console.log(`[KB Sections Seeder] Processing section: ${sectionData.name}`);

      // Check if section already exists
      const existingSection = existingSections.find(s => s.attributes.name === sectionData.name);
      console.log(`[KB Sections Seeder] Section ${sectionData.name} exists: ${!!existingSection}`);

      let section;
      if (existingSection) {
        console.log(`[KB Sections Seeder] Section already exists: ${existingSection.attributes.name}`);
        section = existingSection;
      } else {
        // Create new section
        console.log(`[KB Sections Seeder] Creating new section: ${sectionData.name}`);
        section = await registry.createSection({
          name: sectionData.name,
          description: sectionData.description,
          order: '100' // Default order
        });

        if (!section) {
          throw new Error(`Failed to create section: ${sectionData.name}`);
        }

        console.log(`[KB Sections Seeder] Created section: ${section.attributes.name} (${section.attributes.id})`);
      }

      // Ensure section has valid ID before proceeding
      if (!section.attributes.id) {
        throw new Error(`Section ${sectionData.name} has no valid ID`);
      }

      // Clean up existing categories for this section to avoid duplicates
      const existingCategories = await registry.getCategoriesBySection(section.attributes.id);
      if (existingCategories.length > 0) {
        console.log(`[KB Sections Seeder] Cleaning up ${existingCategories.length} existing categories for section ${sectionData.name}`);
        for (const cat of existingCategories) {
          if (cat.attributes.id) {
            await registry.deleteCategory(cat.attributes.id);
          }
        }
      }

      // Create categories for this section
      for (const categoryData of sectionData.categories) {
        console.log(`[KB Sections Seeder] Creating category: ${categoryData.name} in section ${sectionData.name}`);

        const category = await registry.createCategory({
          name: categoryData.name,
          description: categoryData.description,
          section_id: section.attributes.id, // Use the actual section ID
          order: '100' // Default order
        });

        if (!category) {
          throw new Error(`Failed to create category: ${categoryData.name} in section ${sectionData.name}`);
        }

        console.log(`[KB Sections Seeder] ✓ Created category: ${category.attributes.name} (${category.attributes.id}) in section ${section.attributes.name}`);
      }
    }

    console.log('[KB Sections Seeder] Knowledge base sections seeding completed successfully');

    // Verify the seeding worked correctly
    const finalSections = await registry.getSectionsWithCategories();
    console.log(`[KB Sections Seeder] Verification: ${finalSections.length} sections with categories`);

    finalSections.forEach(section => {
      console.log(`[KB Sections Seeder] ✓ Section "${section.name}" has ${section.categories.length} categories`);
    });

    // Log total counts
    const allCategories = await registry.getAllCategories();
    console.log(`[KB Sections Seeder] Total: ${finalSections.length} sections, ${allCategories.length} categories`);

  } catch (error) {
    console.error('[KB Sections Seeder] Failed to seed knowledge base sections:', error);
    console.error('[KB Sections Seeder] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type'
    });
    throw error;
  }
}

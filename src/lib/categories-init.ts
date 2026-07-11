import { prisma } from '@/lib/db/prisma';
import { STANDARD_CATEGORIES } from './categories';

/**
 * Initialize standard categories in the database
 */
export async function initializeCategories(): Promise<void> {
  console.log('Initializing standard categories...');

  for (const categoryDef of STANDARD_CATEGORIES) {
    // Create main category
    const mainCategory = await prisma.category.upsert({
      where: { name: categoryDef.name },
      update: {
        keywords: categoryDef.keywords,
        type: categoryDef.type,
        isActive: true
      },
      create: {
        name: categoryDef.name,
        type: categoryDef.type,
        keywords: categoryDef.keywords,
        level: 0,
        isActive: true
      }
    });

    // Create subcategories if they exist
    if (categoryDef.subcategories) {
      for (const subcatDef of categoryDef.subcategories) {
        await prisma.category.upsert({
          where: { name: subcatDef.name },
          update: {
            keywords: subcatDef.keywords,
            type: subcatDef.type,
            parentId: mainCategory.id,
            isActive: true
          },
          create: {
            name: subcatDef.name,
            type: subcatDef.type,
            keywords: subcatDef.keywords,
            level: 1,
            parentId: mainCategory.id,
            isActive: true
          }
        });
      }
    }
  }

  console.log('Categories initialized successfully');
}

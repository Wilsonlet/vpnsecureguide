import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Run database migrations
 */
async function migrate() {
  console.log('Running database migrations...');

  try {
    // Add description and features columns to subscription_plans if they don't exist
    await db.execute(sql`
      DO $$ BEGIN
        BEGIN
          ALTER TABLE subscription_plans ADD COLUMN description TEXT;
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;

        BEGIN
          ALTER TABLE subscription_plans ADD COLUMN features TEXT;
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
      END $$;
    `);

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

export { migrate };

// This script can be run directly or imported
// When imported, we'll just export the migrate function
// Direct execution is handled in routes.ts
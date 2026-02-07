// DatabaseManager.ts
// Singleton – runs migrations + seeders once per process after backend is ready
// Tracks execution in postgres tables

import { postgresClient } from '@pkg/agent/database/PostgresClient';
import { migrationsRegistry } from './migrations';
import { seedersRegistry } from './seeders';

const MIGRATIONS_TABLE = 'migrations';
const SEEDERS_TABLE   = 'seeders';

interface TrackedItem {
  id: number;
  name: string;
  executed_at: Date;
}

let instance: DatabaseManager | null = null;

export function getDatabaseManager(): DatabaseManager {
  if (!instance) instance = new DatabaseManager();
  return instance;
}

export class DatabaseManager {
  private initialized = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.isPolling) return;

    this.isPolling = true;
    
    this.pollingInterval = setInterval(async () => {
      try {
        // Test database connection
        await postgresClient.initialize();
        console.log('[DB] after postgresClient.initialize');
        await postgresClient.query('SELECT 1');
        console.log('[DB] after postgresClient.query');
        
        // Stop polling once connected
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
        
        // Run migrations and seeders
        await this.runMigrations();
        await this.runSeeders();

        this.initialized = true;
        this.isPolling = false;
        console.log('[DB] Database ready');
      } catch (err: any) {
        // Quiet polling - only debug log connection attempts
        if (err.message && err.message.includes('Postgres not connected')) {
          console.debug('[DB] Waiting for PostgreSQL to become available...');
        } else {
          console.debug('[DB] Connection attempt failed, retrying...');
        }
      }
    }, 2000); // Poll every 2 seconds
  }

  async stop(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
  }

  private async getExecuted(table: string): Promise<Set<string>> {
    const res = await postgresClient.query(`SELECT name FROM ${table}`);
    return new Set(res.rows.map((r: TrackedItem) => r.name));
  }

  private async runMigrations(): Promise<void> {
    console.log('[DB] Running migrations...');

    // Ensure migrations table exists
    try {
      await postgresClient.query(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('[DB] Migrations table created successfully');
    } catch (err: any) {
      if (err.code === '42P07') {
        console.log('[DB] Migrations table already exists');
      } else {
        console.error('[DB] Failed to create migrations table:', err);
        throw err;
      }
    }

    const executed = await this.getExecuted(MIGRATIONS_TABLE);
    
    // Log migration counts
    const totalMigrations = migrationsRegistry.length;
    const alreadyRunCount = Array.from(executed).filter(name => 
      migrationsRegistry.some(mig => mig.name === name)
    ).length;
    const needToRunCount = totalMigrations - alreadyRunCount;
    
    console.log(`[DB] ${alreadyRunCount} migrations already run, ${needToRunCount} migrations need to be run`);

    for (const mig of migrationsRegistry) {
      if (executed.has(mig.name)) {
        console.log(`[DB] Skip migration (already run): ${mig.name}`);
        continue;
      }

      try {
        console.log(`[DB] Running migration: ${mig.name}`);
        await postgresClient.query(mig.up);

        await postgresClient.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1) ON CONFLICT DO NOTHING`,
          [mig.name]
        );
        console.log(`[DB] Migration completed: ${mig.name}`);
      } catch (err) {
        console.error(`Migration failed: ${mig.name}`, err);
        throw err; // fail fast on migrations
      }
    }

    console.log('[DB] Migrations complete');
  }

  private async runSeeders(): Promise<void> {
    console.log('[DB] Running seeders...');

    const executed = await this.getExecuted(SEEDERS_TABLE);

    for (const seeder of seedersRegistry) {
      if (executed.has(seeder.name)) {
        console.log(`[DB] Skip seeder (already run): ${seeder.name}`);
        continue;
      }

      try {
        console.log(`[DB] Running seeder: ${seeder.name}`);
        await seeder.run();

        await postgresClient.query(
          `INSERT INTO ${SEEDERS_TABLE} (name) VALUES ($1) ON CONFLICT DO NOTHING`,
          [seeder.name]
        );
      } catch (err) {
        console.error(`Seeder failed: ${seeder.name}`, err);
        // seeders usually non-fatal → continue
      }
    }

    console.log('[DB] Seeders complete');
  }
}
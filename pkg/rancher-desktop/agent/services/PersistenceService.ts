// PersistenceService - PostgreSQL and Redis connections for conversation persistence
// Uses only pg and ioredis - NO LangChain imports

import pg from 'pg';
import Redis from 'ioredis';

const POSTGRES_URL = 'postgresql://sulla:sulla_dev_password@127.0.0.1:30116/sulla';
const REDIS_URL = 'redis://127.0.0.1:30117';

export interface EnabledSkillRecord {
  id: string;
  title: string;
  description: string;
  how_to_run: string;
  meta: Record<string, unknown>;
  enabled_at: string;
  updated_at: string;
}

export class PersistenceService {
  private initialized = false;
  private pgConnected = false;
  private redisConnected = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[Persistence] Initializing...');
    console.log(`[Persistence] PostgreSQL: ${POSTGRES_URL}`);
    console.log(`[Persistence] Redis: ${REDIS_URL}`);

    this.pgConnected = await this.testPostgres();
    this.redisConnected = await this.testRedis();

    if (this.pgConnected) {
      await this.ensureEnabledSkillsTable();
    }

    console.log(`[Persistence] PostgreSQL connected: ${this.pgConnected}`);
    console.log(`[Persistence] Redis connected: ${this.redisConnected}`);

    this.initialized = true;
  }

  private async ensureEnabledSkillsTable(): Promise<void> {
    if (!this.pgConnected) {
      return;
    }

    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();

      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'enabled_skills'
        )
      `);
      const tableExists = tableCheck.rows[0].exists;

      await client.query(`
        CREATE TABLE IF NOT EXISTS enabled_skills (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          how_to_run TEXT NOT NULL,
          meta JSONB NOT NULL,
          enabled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      if (!tableExists) {
        console.log('[Persistence:PG] Created enabled_skills table');
      }

      await client.end();
    } catch (err) {
      console.warn('[Persistence:PG] Ensure enabled_skills table failed:', err);
    }
  }

  async enableSkill(input: {
    id: string;
    title: string;
    description: string;
    how_to_run: string;
    meta: Record<string, unknown>;
  }): Promise<void> {
    if (!this.pgConnected) {
      return;
    }

    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();
      await this.ensureEnabledSkillsTable();

      await client.query(
        `
        INSERT INTO enabled_skills (id, title, description, how_to_run, meta, enabled_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id)
        DO UPDATE SET title = $2, description = $3, how_to_run = $4, meta = $5, updated_at = CURRENT_TIMESTAMP
      `,
        [
          input.id,
          input.title,
          input.description,
          input.how_to_run,
          JSON.stringify(input.meta ?? {}),
        ],
      );

      await client.end();
    } catch (err) {
      console.warn('[Persistence:PG] Enable skill failed:', err);
    }
  }

  async disableSkill(id: string): Promise<void> {
    if (!this.pgConnected) {
      return;
    }

    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();
      await this.ensureEnabledSkillsTable();

      await client.query('DELETE FROM enabled_skills WHERE id = $1', [id]);
      await client.end();
    } catch (err) {
      console.warn('[Persistence:PG] Disable skill failed:', err);
    }
  }

  async listEnabledSkills(): Promise<EnabledSkillRecord[]> {
    if (!this.pgConnected) {
      return [];
    }

    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();
      await this.ensureEnabledSkillsTable();

      const result = await client.query(
        'SELECT id, title, description, how_to_run, meta, enabled_at, updated_at FROM enabled_skills ORDER BY enabled_at DESC',
      );

      await client.end();

      return (result.rows ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        how_to_run: row.how_to_run,
        meta: row.meta ?? {},
        enabled_at: String(row.enabled_at ?? ''),
        updated_at: String(row.updated_at ?? ''),
      }));
    } catch (err) {
      console.warn('[Persistence:PG] List enabled skills failed:', err);

      return [];
    }
  }

  async isSkillEnabled(id: string): Promise<boolean> {
    if (!this.pgConnected) {
      return false;
    }

    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();
      await this.ensureEnabledSkillsTable();

      const result = await client.query('SELECT 1 FROM enabled_skills WHERE id = $1', [id]);

      await client.end();

      return (result.rows?.length ?? 0) > 0;
    } catch (err) {
      console.warn('[Persistence:PG] isSkillEnabled failed:', err);

      return false;
    }
  }

  async getEnabledSkill(id: string): Promise<EnabledSkillRecord | null> {
    if (!this.pgConnected) {
      return null;
    }

    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();
      await this.ensureEnabledSkillsTable();

      const result = await client.query(
        'SELECT id, title, description, how_to_run, meta, enabled_at, updated_at FROM enabled_skills WHERE id = $1',
        [id],
      );

      await client.end();

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as any;

      return {
        id:          row.id,
        title:       row.title,
        description: row.description,
        how_to_run:  row.how_to_run,
        meta:        row.meta ?? {},
        enabled_at:  String(row.enabled_at ?? ''),
        updated_at:  String(row.updated_at ?? ''),
      };
    } catch (err) {
      console.warn('[Persistence:PG] getEnabledSkill failed:', err);

      return null;
    }
  }

  async loadAwareness(): Promise<Record<string, unknown> | null> {
    if (!this.pgConnected) {
      return null;
    }

    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();

      // Ensure table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'agent_awareness'
        )
      `);
      const tableExists = tableCheck.rows[0].exists;

      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_awareness (
          id INTEGER PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      if (!tableExists) {
        console.log('[Persistence:PG] Created agent_awareness table');
      }

      const result = await client.query(
        'SELECT data FROM agent_awareness WHERE id = 1',
      );

      await client.end();

      if (result.rows.length > 0) {
        return result.rows[0].data as Record<string, unknown>;
      }

      return null;
    } catch (err) {
      console.warn('[Persistence:PG] Load awareness failed:', err);

      return null;
    }
  }

  async saveAwareness(data: Record<string, unknown>): Promise<void> {
    if (!this.pgConnected) {
      return;
    }

    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();

      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_awareness (
          id INTEGER PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(
        `
        INSERT INTO agent_awareness (id, data, updated_at)
        VALUES (1, $1, CURRENT_TIMESTAMP)
        ON CONFLICT (id)
        DO UPDATE SET data = $1, updated_at = CURRENT_TIMESTAMP
      `,
        [JSON.stringify(data)],
      );

      await client.end();
    } catch (err) {
      console.warn('[Persistence:PG] Save awareness failed:', err);
    }
  }

  private async testPostgres(): Promise<boolean> {
    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();
      await client.query('SELECT 1');
      await client.end();

      return true;
    } catch (err) {
      console.warn('[Persistence] PostgreSQL test failed:', err);

      return false;
    }
  }

  private async testRedis(): Promise<boolean> {
    try {
      const redis = new Redis(REDIS_URL);

      await redis.ping();
      await redis.quit();

      return true;
    } catch (err) {
      console.warn('[Persistence] Redis test failed:', err);

      return false;
    }
  }

  async storeConversation(threadId: string, messages: Array<{ role: string; content: string }>): Promise<void> {
    if (!this.pgConnected) {
      return;
    }

    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();

      // Check if table exists first
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'conversations'
        )
      `);
      const tableExists = tableCheck.rows[0].exists;

      await client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id SERIAL PRIMARY KEY,
          thread_id VARCHAR(255) NOT NULL UNIQUE,
          messages JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      if (!tableExists) {
        console.log('[Persistence:PG] Created conversations table');
      }

      await client.query(`
        INSERT INTO conversations (thread_id, messages, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (thread_id) 
        DO UPDATE SET messages = $2, updated_at = CURRENT_TIMESTAMP
      `, [threadId, JSON.stringify(messages)]);

      await client.end();
      console.log(`[Persistence:PG] Stored thread: ${threadId} (${messages.length} messages)`);
    } catch (err) {
      console.warn('[Persistence:PG] Store failed:', err);
    }
  }

  async loadConversation(threadId: string): Promise<Array<{ role: string; content: string }> | null> {
    if (!this.pgConnected) {
      return null;
    }

    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();

      // Check if table exists first
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'conversations'
        )
      `);

      if (!tableCheck.rows[0].exists) {
        await client.end();
        console.log('[Persistence:PG] Conversations table not yet created');

        return null;
      }

      const result = await client.query(
        'SELECT messages FROM conversations WHERE thread_id = $1',
        [threadId],
      );

      await client.end();

      if (result.rows.length > 0) {
        const messages = result.rows[0].messages;

        console.log(`[Persistence:PG] Loaded thread: ${threadId} (${messages.length} messages)`);

        return messages;
      }

      console.log(`[Persistence:PG] No conversation found: ${threadId}`);

      return null;
    } catch (err) {
      console.warn('[Persistence:PG] Load failed:', err);

      return null;
    }
  }

  async cacheSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.redisConnected) {
      return;
    }

    try {
      const redis = new Redis(REDIS_URL);

      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, value);
        console.log(`[Persistence:Redis] SET ${key} (TTL: ${ttlSeconds}s)`);
      } else {
        await redis.set(key, value);
        console.log(`[Persistence:Redis] SET ${key}`);
      }

      await redis.quit();
    } catch (err) {
      console.warn('[Persistence:Redis] SET failed:', err);
    }
  }

  async cacheGet(key: string): Promise<string | null> {
    if (!this.redisConnected) {
      return null;
    }

    try {
      const redis = new Redis(REDIS_URL);
      const value = await redis.get(key);

      await redis.quit();

      if (value) {
        console.log(`[Persistence:Redis] GET ${key} - HIT`);
      } else {
        console.log(`[Persistence:Redis] GET ${key} - MISS`);
      }

      return value;
    } catch (err) {
      console.warn('[Persistence:Redis] GET failed:', err);

      return null;
    }
  }
}

// Singleton
let service: PersistenceService | null = null;

export function getPersistenceService(): PersistenceService {
  if (!service) {
    service = new PersistenceService();
  }

  return service;
}

import type { Integration } from '../types';

export const nativeDatabaseIntegrations: Record<string, Integration> = {
  supabase: {
    id: 'supabase', sort: 1, paid: false, beta: false, comingSoon: false, connected: false,
    name: 'Supabase', description: 'Query Postgres databases, manage auth users, and interact with Supabase storage and edge functions.',
    category: 'Database', icon: '⚡', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Supabase',
  },
  firebase: {
    id: 'firebase', sort: 2, paid: false, beta: false, comingSoon: false, connected: false,
    name: 'Firebase', description: 'Manage Firestore documents, Realtime Database, authentication, and cloud functions.',
    category: 'Database', icon: '🔥', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Google',
  },
  mongodb: {
    id: 'mongodb', sort: 3, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'MongoDB Atlas', description: 'Query collections, manage documents, and administer MongoDB Atlas clusters.',
    category: 'Database', icon: '🍃', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'MongoDB',
  },
  planetscale: {
    id: 'planetscale', sort: 4, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'PlanetScale', description: 'Manage MySQL-compatible serverless databases, branches, and deploy requests.',
    category: 'Database', icon: '🪐', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'PlanetScale',
  },
  upstash: {
    id: 'upstash', sort: 5, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Upstash', description: 'Manage serverless Redis and Kafka instances. Execute commands and manage topics.',
    category: 'Database', icon: '🟥', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Upstash',
  },
  neon: {
    id: 'neon', sort: 6, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Neon', description: 'Manage serverless Postgres databases, branches, and connection pooling.',
    category: 'Database', icon: '💚', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Neon',
  },
  cockroachdb: {
    id: 'cockroachdb', sort: 7, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'CockroachDB', description: 'Manage distributed SQL databases, clusters, and multi-region deployments.',
    category: 'Database', icon: '🪳', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Cockroach Labs',
  },
  airtable_db: {
    id: 'airtable_db', sort: 8, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Airtable', description: 'Query bases, manage records, and automate structured data workflows.',
    category: 'Database', icon: '🗂️', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Airtable',
  },
  dynamodb: {
    id: 'dynamodb', sort: 9, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'AWS DynamoDB', description: 'Manage tables, items, and queries in Amazon DynamoDB.',
    category: 'Database', icon: '⚡', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Amazon',
  },
  turso: {
    id: 'turso', sort: 10, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Turso', description: 'Manage edge-replicated SQLite databases powered by libSQL.',
    category: 'Database', icon: '🟢', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Turso',
  },
  fauna: {
    id: 'fauna', sort: 11, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Fauna', description: 'Query document-relational databases with distributed ACID transactions.',
    category: 'Database', icon: '🌿', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Fauna',
  },
  hasura: {
    id: 'hasura', sort: 12, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Hasura', description: 'Manage instant GraphQL and REST APIs over your databases.',
    category: 'Database', icon: '🔷', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Hasura',
  },
  convex: {
    id: 'convex', sort: 13, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Convex', description: 'Manage reactive backend-as-a-service with real-time queries and mutations.',
    category: 'Database', icon: '🟠', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Convex',
  },
  xata: {
    id: 'xata', sort: 14, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Xata', description: 'Manage serverless Postgres with built-in search, analytics, and branching.',
    category: 'Database', icon: '🦋', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Xata',
  },
  tidb: {
    id: 'tidb', sort: 15, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'TiDB', description: 'Manage distributed MySQL-compatible databases with HTAP workloads.',
    category: 'Database', icon: '🔴', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'PingCAP',
  },
  surrealdb: {
    id: 'surrealdb', sort: 16, paid: false, beta: false, comingSoon: false, connected: false,
    name: 'SurrealDB', description: 'Query multi-model databases with SQL-like syntax for documents, graphs, and time series.',
    category: 'Database', icon: '🟣', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'SurrealDB',
  },
};

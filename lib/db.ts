import { MongoClient, ObjectId, type Db } from 'mongodb';

/**
 * MongoDB access that works both on Node (local dev / self-hosting) and on
 * Cloudflare Workers.
 *
 * - Node: one pooled client is cached for the process.
 * - Workers: TCP sockets are bound to the request that created them, so a client
 *   is created per call and closed afterwards.
 */

const isWorkers =
  typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  /** Bumped on logout to revoke every outstanding session cookie. */
  sv?: number;
  ai?: { provider: 'openai' | 'anthropic'; model: string; baseURL?: string; apiKeyEnc?: string };
  createdAt: Date;
}

export interface ResumeDoc {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  latexSource: string;
  templateId?: string;
  isPublished: boolean;
  slug?: string;
  compile?: { status: 'success' | 'error'; at: Date; error?: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface PdfDoc {
  _id: ObjectId; // same id as the resume
  data: Buffer;
  at: Date;
}

export interface ChatDoc {
  _id: ObjectId;
  resumeId: ObjectId;
  userId: ObjectId;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface TokenDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  tokenHash: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

function uri(): string {
  const u = process.env.MONGODB_URI;
  if (!u) throw new Error('MONGODB_URI is not set');
  return u;
}

const g = globalThis as unknown as { __mongoClient?: Promise<MongoClient> };

function nodeClient(): Promise<MongoClient> {
  if (!g.__mongoClient) {
    g.__mongoClient = new MongoClient(uri(), {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    }).connect();
    g.__mongoClient.catch(() => {
      g.__mongoClient = undefined;
    });
  }
  return g.__mongoClient;
}

export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  if (!isWorkers) {
    const client = await nodeClient();
    return fn(client.db());
  }
  const client = new MongoClient(uri(), {
    maxPoolSize: 1,
    serverSelectionTimeoutMS: 8000,
  });
  try {
    await client.connect();
    return await fn(client.db());
  } finally {
    await client.close().catch(() => {});
  }
}

export async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('resumes').createIndex({ userId: 1, updatedAt: -1 }),
    db.collection('resumes').createIndex({ slug: 1 }, { unique: true, sparse: true }),
    db.collection('chats').createIndex({ resumeId: 1, createdAt: 1 }),
    db.collection('tokens').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection('ratelimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('locks').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

export function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id ? new ObjectId(id) : null;
}

export const col = {
  users: (db: Db) => db.collection<UserDoc>('users'),
  resumes: (db: Db) => db.collection<ResumeDoc>('resumes'),
  pdfs: (db: Db) => db.collection<PdfDoc>('pdfs'),
  chats: (db: Db) => db.collection<ChatDoc>('chats'),
  tokens: (db: Db) => db.collection<TokenDoc>('tokens'),
};

// Creates the indexes the app relies on. Safe to run repeatedly.
//   MONGODB_URI=... node scripts/db-init.mjs      (or: pnpm db:init, which reads .env.local)
import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!process.env.MONGODB_URI && existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  }
}
if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is not set'); process.exit(1); }

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const db = client.db();
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('resumes').createIndex({ userId: 1, updatedAt: -1 });
  await db.collection('resumes').createIndex({ slug: 1 }, { unique: true, sparse: true });
  await db.collection('chats').createIndex({ resumeId: 1, createdAt: 1 });
  await db.collection('tokens').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('ratelimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('locks').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  console.log(`Indexes ready on database "${db.databaseName}"`);
} finally {
  await client.close();
}

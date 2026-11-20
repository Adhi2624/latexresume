import { ObjectId } from 'mongodb';
import { authed, fail, ok, readJson } from '@/lib/http';
import { col, withDb } from '@/lib/db';
import { encryptSecret } from '@/lib/security';
import { settingsSchema } from '@/lib/validation';
import { DEFAULT_MODELS } from '@/lib/ai';

function view(u: { email: string; name: string; ai?: { provider: string; model: string; baseURL?: string; apiKeyEnc?: string } }) {
  return {
    email: u.email,
    name: u.name,
    ai: {
      provider: u.ai?.provider ?? 'openai',
      model: u.ai?.model ?? '',
      baseURL: u.ai?.baseURL ?? '',
      hasApiKey: Boolean(u.ai?.apiKeyEnc),
      serverKeyAvailable: Boolean(process.env.OPENAI_API_KEY),
      defaultModels: DEFAULT_MODELS,
    },
  };
}

export const GET = authed(async (_req, s) => {
  const u = await withDb((db) => col.users(db).findOne({ _id: new ObjectId(s.userId) }));
  return u ? ok(view(u)) : fail('Unauthorized', 401);
});

export const PUT = authed(async (req, s) => {
  const body = settingsSchema.parse(await readJson(req));
  const u = await withDb(async (db) => {
    const cur = await col.users(db).findOne({ _id: new ObjectId(s.userId) });
    if (!cur) return null;
    const set: Record<string, unknown> = {};
    if (body.name) set.name = body.name;
    if (body.ai) {
      let apiKeyEnc = cur.ai?.apiKeyEnc;
      if (body.ai.clearKey) apiKeyEnc = undefined;
      if (body.ai.apiKey) apiKeyEnc = await encryptSecret(body.ai.apiKey);
      set.ai = {
        provider: body.ai.provider,
        model: body.ai.model ?? '',
        ...(body.ai.baseURL ? { baseURL: body.ai.baseURL } : {}),
        ...(apiKeyEnc ? { apiKeyEnc } : {}),
      };
    }
    return col.users(db).findOneAndUpdate({ _id: cur._id }, { $set: set }, { returnDocument: 'after' });
  });
  return u ? ok(view(u)) : fail('Unauthorized', 401);
});

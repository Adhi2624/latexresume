import { ObjectId } from 'mongodb';
import { col, toObjectId, withDb, type ResumeDoc } from './db';
import { compileLatex } from './latex';
import { getTemplate } from './templates';
import { randomToken } from './security';
import { acquireLock, rateLimit, releaseLock } from './ratelimit';

export class NotFound extends Error {}

export const serialize = (r: ResumeDoc, withSource = false) => ({
  id: String(r._id),
  title: r.title,
  templateId: r.templateId,
  isPublished: r.isPublished,
  slug: r.slug,
  publicPath: r.isPublished && r.slug ? `/r/${r.slug}` : undefined,
  compile: r.compile,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  ...(withSource ? { latexSource: r.latexSource } : {}),
});

function oid(id: string): ObjectId {
  const o = toObjectId(id);
  if (!o) throw new NotFound();
  return o;
}

/** First few meaningful lines of the document body, for dashboard cards. */
function previewOf(source: string): string[] {
  const body = source.includes('\\begin{document}') ? source.split('\\begin{document}')[1] : source;
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('%') && !l.startsWith('\\end{document}'))
    .slice(0, 3)
    .map((l) => l.slice(0, 70));
}

export async function listResumes(userId: string) {
  const docs = await withDb((db) =>
    col.resumes(db).find({ userId: new ObjectId(userId) }).sort({ updatedAt: -1 }).limit(200).toArray(),
  );
  return docs.map((d) => ({ ...serialize(d), preview: previewOf(d.latexSource) }));
}

export async function getResume(userId: string, id: string) {
  const doc = await withDb((db) =>
    col.resumes(db).findOne({ _id: oid(id), userId: new ObjectId(userId) }),
  );
  if (!doc) throw new NotFound();
  return serialize(doc, true);
}

export async function createResume(
  userId: string,
  input: { title: string; templateId?: string; latexSource?: string },
) {
  const template = input.templateId ? getTemplate(input.templateId) : undefined;
  if (input.templateId && !template) throw new NotFound('Unknown template');
  const now = new Date();
  const doc: Omit<ResumeDoc, '_id'> = {
    userId: new ObjectId(userId),
    title: input.title,
    latexSource: input.latexSource ?? template?.latexSource ?? getTemplate('blank')!.latexSource,
    templateId: template?.id,
    isPublished: false,
    createdAt: now,
    updatedAt: now,
  };
  const r = await withDb((db) => col.resumes(db).insertOne(doc as ResumeDoc));
  return serialize({ ...doc, _id: r.insertedId }, true);
}

export async function updateResume(
  userId: string,
  id: string,
  patch: { title?: string; latexSource?: string },
) {
  const set: Partial<ResumeDoc> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.latexSource !== undefined) set.latexSource = patch.latexSource;
  const doc = await withDb((db) =>
    col.resumes(db).findOneAndUpdate(
      { _id: oid(id), userId: new ObjectId(userId) },
      { $set: set },
      { returnDocument: 'after' },
    ),
  );
  if (!doc) throw new NotFound();
  return serialize(doc, true);
}

export async function deleteResume(userId: string, id: string) {
  const ok = await withDb(async (db) => {
    const r = await col.resumes(db).deleteOne({ _id: oid(id), userId: new ObjectId(userId) });
    if (!r.deletedCount) return false;
    await Promise.all([
      col.pdfs(db).deleteOne({ _id: oid(id) }),
      col.chats(db).deleteMany({ resumeId: oid(id) }),
    ]);
    return true;
  });
  if (!ok) throw new NotFound();
}

/** Compiles (optionally an unsaved `source`), stores the PDF, records the status. */
export async function compileResume(userId: string, id: string, source?: string) {
  const resume = await withDb((db) =>
    col.resumes(db).findOne({ _id: oid(id), userId: new ObjectId(userId) }),
  );
  if (!resume) throw new NotFound();
  await rateLimit(`compile:${userId}`, 30, 60);
  // One in-flight compile per user so a single account can't monopolise the compiler.
  const lockKey = `compile:${userId}`;
  if (!(await acquireLock(lockKey, 45))) {
    return { ok: false as const, error: 'A compile is already running for your account. Wait for it to finish.', busy: true };
  }
  let result: Awaited<ReturnType<typeof compileLatex>>;
  try {
    result = await compileLatex(source ?? resume.latexSource);
  } finally {
    await releaseLock(lockKey);
  }
  if (!result.ok && result.busy) return result; // infrastructure issue: keep the last real status
  await withDb(async (db) => {
    const at = new Date();
    await col.resumes(db).updateOne(
      { _id: resume._id },
      {
        $set: {
          compile: result.ok
            ? { status: 'success', at }
            : { status: 'error', at, error: result.error.slice(0, 4000) },
        },
      },
    );
    if (result.ok) {
      await col.pdfs(db).updateOne(
        { _id: resume._id },
        { $set: { data: Buffer.from(result.pdf), at } },
        { upsert: true },
      );
    }
  });
  return result;
}

export async function getPdf(userId: string, id: string): Promise<Uint8Array | null> {
  const pdf = await withDb(async (db) => {
    const r = await col.resumes(db).findOne({ _id: oid(id), userId: new ObjectId(userId) }, { projection: { _id: 1 } });
    if (!r) throw new NotFound();
    return col.pdfs(db).findOne({ _id: r._id });
  });
  return pdf ? new Uint8Array(pdf.data.buffer, pdf.data.byteOffset, pdf.data.length) : null;
}

export async function publishResume(userId: string, id: string) {
  const doc = await withDb(async (db) => {
    const existing = await col.resumes(db).findOne({ _id: oid(id), userId: new ObjectId(userId) });
    if (!existing) return null;
    const slug = existing.slug ?? randomToken(6);
    return col.resumes(db).findOneAndUpdate(
      { _id: existing._id },
      { $set: { isPublished: true, slug, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
  });
  if (!doc) throw new NotFound();
  return serialize(doc);
}

export async function unpublishResume(userId: string, id: string) {
  const doc = await withDb((db) =>
    col.resumes(db).findOneAndUpdate(
      { _id: oid(id), userId: new ObjectId(userId) },
      { $set: { isPublished: false, updatedAt: new Date() } },
      { returnDocument: 'after' },
    ),
  );
  if (!doc) throw new NotFound();
  return serialize(doc);
}

export async function getPublished(slug: string) {
  return withDb(async (db) => {
    const r = await col.resumes(db).findOne({ slug, isPublished: true });
    if (!r) return null;
    const u = await col.users(db).findOne({ _id: r.userId }, { projection: { name: 1 } });
    const hasPdf = Boolean(await col.pdfs(db).findOne({ _id: r._id }, { projection: { _id: 1 } }));
    return { id: String(r._id), title: r.title, author: u?.name ?? '', hasPdf, updatedAt: r.updatedAt };
  });
}

export async function getPublishedPdf(slug: string): Promise<Uint8Array | null> {
  return withDb(async (db) => {
    const r = await col.resumes(db).findOne({ slug, isPublished: true }, { projection: { _id: 1 } });
    if (!r) return null;
    const pdf = await col.pdfs(db).findOne({ _id: r._id });
    return pdf ? new Uint8Array(pdf.data.buffer, pdf.data.byteOffset, pdf.data.length) : null;
  });
}

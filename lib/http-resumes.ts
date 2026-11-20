import { NotFound } from './resumes';
import { fail } from './http';

/** Maps domain errors to responses; rethrows anything else. */
export async function guard(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotFound) return fail(e.message || 'Not found', 404);
    throw e;
  }
}

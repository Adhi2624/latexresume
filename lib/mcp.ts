import { z } from 'zod';
import { TEMPLATES } from './templates';
import {
  NotFound,
  compileResume,
  createResume,
  deleteResume,
  getResume,
  listResumes,
  publishResume,
  unpublishResume,
  updateResume,
} from './resumes';

type Json = Record<string, unknown>;
interface Tool {
  name: string;
  description: string;
  inputSchema: Json;
  run: (userId: string, args: any) => Promise<unknown>;
}

const idProp = { id: { type: 'string', description: 'Resume id' } };
const obj = (properties: Json, required: string[] = []) => ({ type: 'object', properties, required });

const parse = <T extends z.ZodTypeAny>(s: T, v: unknown): z.infer<T> => s.parse(v);

export const TOOLS: Tool[] = [
  {
    name: 'list_templates',
    description: 'List the built-in LaTeX resume templates.',
    inputSchema: obj({}),
    run: async () => TEMPLATES.map(({ latexSource: _s, ...t }) => t),
  },
  {
    name: 'list_resumes',
    description: "List the user's resumes (metadata only).",
    inputSchema: obj({}),
    run: (u) => listResumes(u),
  },
  {
    name: 'get_resume',
    description: 'Get a resume including its LaTeX source.',
    inputSchema: obj(idProp, ['id']),
    run: (u, a) => getResume(u, parse(z.object({ id: z.string() }), a).id),
  },
  {
    name: 'create_resume',
    description: 'Create a resume from a built-in template (template_id) or from raw LaTeX (latex_source).',
    inputSchema: obj(
      {
        title: { type: 'string' },
        template_id: { type: 'string', enum: TEMPLATES.map((t) => t.id) },
        latex_source: { type: 'string', description: 'Full LaTeX document; overrides the template' },
      },
      ['title'],
    ),
    run: (u, a) => {
      const v = parse(
        z.object({ title: z.string().min(1).max(120), template_id: z.string().optional(), latex_source: z.string().max(500_000).optional() }),
        a,
      );
      return createResume(u, { title: v.title, templateId: v.template_id, latexSource: v.latex_source });
    },
  },
  {
    name: 'update_resume',
    description: "Update a resume's title and/or replace its LaTeX source.",
    inputSchema: obj({ ...idProp, title: { type: 'string' }, latex_source: { type: 'string' } }, ['id']),
    run: (u, a) => {
      const v = parse(
        z.object({ id: z.string(), title: z.string().min(1).max(120).optional(), latex_source: z.string().max(500_000).optional() }),
        a,
      );
      return updateResume(u, v.id, { title: v.title, latexSource: v.latex_source });
    },
  },
  {
    name: 'delete_resume',
    description: 'Permanently delete a resume.',
    inputSchema: obj(idProp, ['id']),
    run: async (u, a) => {
      await deleteResume(u, parse(z.object({ id: z.string() }), a).id);
      return { deleted: true };
    },
  },
  {
    name: 'compile_resume',
    description:
      'Compile the saved LaTeX to PDF. Returns success or the TeX error. On success the PDF is downloadable with the same bearer token at GET /api/resumes/{id}/pdf.',
    inputSchema: obj(idProp, ['id']),
    run: async (u, a) => {
      const { id } = parse(z.object({ id: z.string() }), a);
      const r = await compileResume(u, id);
      if (!r.ok) throw new ToolError(`LaTeX compilation failed: ${r.error}${r.log ? `\n\n${r.log.slice(-3000)}` : ''}`);
      return { success: true, bytes: r.pdf.length, pdfPath: `/api/resumes/${id}/pdf` };
    },
  },
  {
    name: 'publish_resume',
    description: 'Publish the resume and return its public path (compile it first so the public page has a PDF).',
    inputSchema: obj(idProp, ['id']),
    run: (u, a) => publishResume(u, parse(z.object({ id: z.string() }), a).id),
  },
  {
    name: 'unpublish_resume',
    description: 'Make a published resume private again.',
    inputSchema: obj(idProp, ['id']),
    run: (u, a) => unpublishResume(u, parse(z.object({ id: z.string() }), a).id),
  },
];

export class ToolError extends Error {}

const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];

interface RpcRequest { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: any }

const rpcError = (id: RpcRequest['id'], code: number, message: string) => ({
  jsonrpc: '2.0', id: id ?? null, error: { code, message },
});

/** Handles one JSON-RPC message. Returns null for notifications. */
export async function handleRpc(msg: RpcRequest, userId: string): Promise<Json | null> {
  if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return rpcError(null, -32600, 'Invalid Request');
  const isNotification = msg.id === undefined;
  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return rpcError(msg.id, -32600, 'Invalid Request');
  switch (msg.method) {
    case 'initialize': {
      const wanted = msg.params?.protocolVersion;
      return {
        jsonrpc: '2.0', id: msg.id,
        result: {
          protocolVersion: SUPPORTED.includes(wanted) ? wanted : SUPPORTED[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'latexresume', version: '0.1.0' },
          instructions: 'Manage LaTeX resumes: list/create/edit, compile to PDF, publish.',
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id: msg.id, result: {} };
    case 'tools/list':
      return {
        jsonrpc: '2.0', id: msg.id,
        result: { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) },
      };
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return rpcError(msg.id, -32602, `Unknown tool: ${msg.params?.name}`);
      try {
        const out = await tool.run(userId, msg.params?.arguments ?? {});
        return { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] } };
      } catch (e) {
        const text =
          e instanceof z.ZodError ? `Invalid arguments: ${e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
          : e instanceof NotFound ? e.message || 'Not found'
          : e instanceof ToolError ? e.message
          : (console.error(e), 'Internal error');
        return { jsonrpc: '2.0', id: msg.id, result: { isError: true, content: [{ type: 'text', text }] } };
      }
    }
    default:
      if (isNotification || msg.method.startsWith('notifications/')) return null;
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

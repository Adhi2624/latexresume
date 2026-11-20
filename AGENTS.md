<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LaTeXResume — notes for coding agents

- Stack: Next.js (App Router) → runs on Node **and** Cloudflare Workers (OpenNext). Data: MongoDB via the native driver (`lib/db.ts`, `withDb`). Compiler: separate service in `compiler/`.
- Workers constraints: no filesystem, WebCrypto only (no `node:crypto`), no `mongodb+srv://`, one short-lived Mongo client per request.
- Always run before finishing: `pnpm lint && pnpm test && pnpm build && pnpm exec opennextjs-cloudflare build`.
- Design system: dark theme tokens live in `app/globals.css` (Geist + JetBrains Mono, indigo primary). Reuse `.eyebrow`, `.surface-card`, `.code-chip`.
- Default local ports: app 3000, compiler 9000, MongoDB 27017 (database `latexresume`).
- Specialised maintainers live in `.claude/agents/` (uat-tester, api-mcp-tester, release-reviewer, dependency-maintainer).

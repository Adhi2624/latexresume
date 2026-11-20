# LaTeXResume

An open-source, self-hostable **LaTeX resume builder** with live PDF preview, an **AI assistant**
(bring your own key) and a built-in **MCP server**. Run it locally with Docker, or deploy it to
**Cloudflare Workers** with **MongoDB Atlas**.

- ✍️ Monaco editor + real TeX Live compilation (your resume is just a `.tex` file)
- 🤖 AI chat with OpenAI, Anthropic or any OpenAI-compatible endpoint (Ollama, OpenRouter, vLLM…); keys are stored AES-GCM encrypted
- 🔌 MCP server at `/mcp` — let Claude, Cursor, etc. list, edit, compile and publish resumes
- 🔗 Publish a resume to a public URL (and unpublish)
- 🪶 No plans, billing or tracking. MIT licensed.

## Architecture

```
Browser ──► Next.js app (Node, or Cloudflare Worker via OpenNext) ──► MongoDB (Community locally / Atlas in prod)
                         │
                         └──► LaTeX compiler service (Docker, TeX Live)   ← Workers cannot run TeX
```

Workers can't execute `pdflatex`, so compilation lives in a small separate service (`compiler/`).
Run it with Docker anywhere (Fly.io, Railway, a VPS, Cloud Run, Cloudflare Containers…) and point
`LATEX_COMPILER_URL` at it.

## Quick start (local)

Requirements: Node 20.9+, [pnpm](https://pnpm.io) 9 (`corepack enable`), Docker.

```bash
pnpm install
cp .env.example .env.local        # then set JWT_SECRET and ENCRYPTION_SECRET (openssl rand -base64 48)
pnpm services                     # MongoDB Community + LaTeX compiler (docker compose --env-file .env.local up -d)
pnpm dev                          # http://localhost:3000
```

Already running MongoDB on 27017? Use `docker compose up -d compiler`, or change the host port with
`MONGO_PORT=27018 docker compose up -d` and update `MONGODB_URI`.

Create an account at `/auth/signup`, pick a template, press **Compile**.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | ✅ | Connection string; the database name comes from the path (`…/latexresume`). |
| `JWT_SECRET` | ✅ | ≥16 chars; signs session cookies. `openssl rand -base64 48` |
| `ENCRYPTION_SECRET` | ✅ | Encrypts users' stored AI API keys. |
| `LATEX_COMPILER_URL` | ✅ | URL of the compiler service. |
| `LATEX_COMPILER_TOKEN` | – | Shared secret (the compiler's `AUTH_TOKEN`). |
| `ALLOW_SIGNUP` | – | `false` closes registration (recommended for personal instances). |
| `OPENAI_API_KEY` | – | Server-wide default AI key; users may bring their own. |
| `NEXT_PUBLIC_REPO_URL` | – | Shows GitHub links in the UI (**build time** — set it when running `pnpm build`/`pnpm deploy`). |
| `ALLOW_PRIVATE_AI_URLS` | – | Production only: allow loopback/private AI base URLs (blocked by default to prevent SSRF). |
| `RATE_LIMIT_SCALE` | – | Multiplier for built-in rate limits (default `1` in production, `100` in development). |
| `TRUST_PROXY` | – | Set `true` only behind a reverse proxy that sets `X-Forwarded-For`; otherwise per-IP limits share one bucket. |
| `ALLOW_CUSTOM_AI_URLS` | – | `false` disables user-supplied AI base URLs entirely (recommended on shared hosts). |

Compiler service (`compiler/`) variables: `PORT` (9000), `AUTH_TOKEN`, `COMPILE_TIMEOUT_MS` (30000), `MAX_CONCURRENT` (2).
**Never expose the compiler publicly without `AUTH_TOKEN`** — it executes TeX on behalf of callers.

## Deploy

- **Vercel (app) + Render (compiler) + MongoDB Atlas:** see **[docs/DEPLOY-VERCEL-RENDER.md](docs/DEPLOY-VERCEL-RENDER.md)**.
- **Cloudflare Workers + MongoDB Atlas:** below.

### Cloudflare Workers + MongoDB Atlas

See **[docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md)**. In short:

```bash
pnpm db:init                                  # once, creates indexes (against Atlas)
npx wrangler secret put MONGODB_URI           # standard (non-SRV) Atlas string!
npx wrangler secret put JWT_SECRET
npx wrangler secret put ENCRYPTION_SECRET
npx wrangler secret put LATEX_COMPILER_URL
pnpm deploy
```

## MCP server

Create an API token in **Settings → API tokens & MCP**, then add the server to your client:

```json
{ "mcpServers": { "latexresume": { "type": "http", "url": "https://YOUR-HOST/mcp",
  "headers": { "Authorization": "Bearer lrp_…" } } } }
```

Tools: `list_templates`, `list_resumes`, `get_resume`, `create_resume`, `update_resume`,
`delete_resume`, `compile_resume`, `publish_resume`, `unpublish_resume`. Details in [docs/MCP.md](docs/MCP.md).

## Development

```bash
pnpm lint     # typecheck
pnpm test     # end-to-end API tests (needs the app, MongoDB and compiler running)
pnpm build    # production build
pnpm preview  # build + run in the local Workers runtime
```

## Security notes

- LaTeX is code. The compiler runs `pdflatex` with `-no-shell-escape`, paranoid file access, a timeout, and
  should run in an unprivileged container (the provided compose file drops capabilities and uses a read-only root).
  Don't expose it publicly without `AUTH_TOKEN`.
- Passwords use PBKDF2-SHA256; sessions are signed `httpOnly` cookies that are revoked on logout; API tokens are stored as SHA-256 hashes.
- Rate limits (MongoDB-backed): login 8 failures / 10 min per IP+email and 20 / 15 min per account, signup 10 / hour per IP, compile 30 / min per user with one in-flight compile per user. Behind a reverse proxy set `TRUST_PROXY=true`.
- The AI base URL cannot target private/loopback hosts in production.
- Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under the [MIT License](LICENSE).

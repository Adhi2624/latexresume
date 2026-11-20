# Deploying to Cloudflare Workers + MongoDB Atlas

The app is built with [OpenNext for Cloudflare](https://opennext.js.org/cloudflare) and runs as a single Worker
(static assets + server code). Data lives in MongoDB Atlas. LaTeX compilation runs in a separate container.

## 1. MongoDB Atlas

1. Create a cluster (the free M0 tier works) and a database user.
2. **Network Access:** Workers have no fixed egress IPs, so allow `0.0.0.0/0` (protect the cluster with a strong user password / least-privilege role).
3. **Connection string:** Workers cannot resolve `mongodb+srv://` (DNS SRV lookups). In Atlas choose
   *Connect → Drivers →* **"I need the older, non-SRV connection string"** (Node 2.2.12 or later) and use the
   `mongodb://host1:27017,host2:27017,host3:27017/latexresume?ssl=true&replicaSet=…&authSource=admin&retryWrites=true&w=majority` form.
4. Create indexes once from your machine: `MONGODB_URI='…' pnpm db:init`.

## 2. LaTeX compiler

Build and host `compiler/` anywhere that runs Docker (Fly.io, Railway, Cloud Run, a VPS, Cloudflare Containers).
Set a long random `AUTH_TOKEN` on it and expose it over HTTPS.

```bash
docker build -t latexresume-compiler compiler/
docker run -p 9000:9000 -e AUTH_TOKEN=… --read-only --tmpfs /tmp --cap-drop ALL latexresume-compiler
```

## 3. Worker

```bash
pnpm install
npx wrangler login
npx wrangler secret put MONGODB_URI
npx wrangler secret put JWT_SECRET
npx wrangler secret put ENCRYPTION_SECRET
npx wrangler secret put LATEX_COMPILER_URL      # https://compiler.example.com
npx wrangler secret put LATEX_COMPILER_TOKEN    # the compiler's AUTH_TOKEN
pnpm deploy
```

Optional vars live in `wrangler.jsonc` (`ALLOW_SIGNUP`). Create your account, then set `ALLOW_SIGNUP` to `"false"` and redeploy to close registration.

## 4. Local Workers runtime

`pnpm preview` builds and runs the Worker in `workerd`. Put the same variables in a `.dev.vars` file (git-ignored).
The e2e tests can target it: `BASE_URL=http://localhost:8787 pnpm test`.

## Notes

- `global_fetch_strictly_public` (set in `wrangler.jsonc`) makes Workers refuse `fetch()` to private addresses, which backs up the app's AI base-URL guard against SSRF.
- Behind Cloudflare the client IP comes from `cf-connecting-ip` (not spoofable), so per-IP rate limits work without `TRUST_PROXY`.

- Workers need the `nodejs_compat` flag and a compatibility date ≥ 2024-09-23 for the MongoDB driver (already set).
- The app opens one short-lived MongoDB connection per request on Workers (sockets can't be shared across requests).
- Atlas is a hosted service: the TCP hop from the Worker to Atlas adds latency; pick an Atlas region near your users.

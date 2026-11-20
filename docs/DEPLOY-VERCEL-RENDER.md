# Deploying: Vercel (app) + Render (LaTeX compiler) + MongoDB Atlas

```
Browser ──► Vercel (Next.js: UI + API routes + /mcp) ──► MongoDB Atlas
                         │
                         └──► Render (Docker: TeX Live compiler service)
```

TeX can't run on Vercel's serverless functions, so the only separate backend service is the compiler (`compiler/`), hosted on Render.

## 1. MongoDB Atlas
Create a cluster (free M0 works) and a database user. Under **Network Access** allow `0.0.0.0/0` (Vercel and Render use dynamic IPs; rely on a strong user password).
Copy the connection string; on Vercel the normal `mongodb+srv://…/latexresume` form works.

## 2. Render: compiler
Create a **Web Service** from this repo using the Blueprint (`render.yaml`) or manually: runtime *Docker*, Dockerfile `./compiler/Dockerfile`, context `./compiler`, health check `/health`.
With the Blueprint, Render generates `AUTH_TOKEN` for you (see the service's Environment tab); copy it into `LATEX_COMPILER_TOKEN` on Vercel. If you create the service manually, set `AUTH_TOKEN` to a long random value (`openssl rand -hex 32`). The service refuses to start without it because `REQUIRE_AUTH=true`.
Note the service URL (e.g. `https://latexresume-compiler.onrender.com`).

> Free instances sleep after ~15 minutes without traffic; the first compile afterwards takes 30–60 s (the app waits up to 60 s). Use a paid instance for always-on.

## 3. Vercel: app
Import the repo as a Next.js project (framework preset auto-detected, pnpm via `packageManager`). Environment variables:

| Name | Value |
| --- | --- |
| `MONGODB_URI` | Atlas connection string including the database name |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `ENCRYPTION_SECRET` | `openssl rand -base64 48` |
| `LATEX_COMPILER_URL` | the Render service URL |
| `LATEX_COMPILER_TOKEN` | same value as the compiler's `AUTH_TOKEN` |
| `ALLOW_SIGNUP` | `true` (set `false` after creating your account) |
| `NEXT_PUBLIC_REPO_URL` | optional, shows GitHub links (build time) |

Run `MONGODB_URI=… pnpm db:init` once to create indexes (they are also created on first signup).

## 4. Verify
`curl https://YOUR-APP.vercel.app/api/health` → `{"status":"ok","database":"up","compiler":true}`; then sign up, compile a template, and publish.
Run the end-to-end suite against it: `BASE_URL=https://YOUR-APP.vercel.app pnpm test` (creates throwaway users).

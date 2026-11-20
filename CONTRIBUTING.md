# Contributing

Thanks for helping! Quick start: see the [README](README.md). Then:

1. Fork and create a branch.
2. `pnpm lint && pnpm test && pnpm build` must pass (tests need `docker compose up -d` and `pnpm dev`).
3. Add or update tests in `tests/` for behaviour changes; keep PRs focused.
4. Open a pull request describing *what* and *why*.

## Guidelines

- Keep the Cloudflare Workers constraints in mind: no filesystem, no Node-only APIs in app code, WebCrypto instead of `node:crypto`.
- No telemetry, billing or paywalls — this project stays self-hostable and free.
- New LaTeX templates must compile with the stock compiler image (`compiler/Dockerfile`) and use placeholder data only.

## Code of conduct

Be kind and constructive. Harassment of any kind is not tolerated; maintainers may remove comments or contributors that violate this.

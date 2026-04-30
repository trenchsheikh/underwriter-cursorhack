# AGENTS.md

## Repo overview

`underwriter-cursorhack` is the Mandate demo: an autonomous VC-underwriting
agent that fans out six diligence desks, streams findings to a Next.js UI, and
either queues a wire or holds and proposes a mandate amendment.

- **`backend/`** — Next.js 16 / React 19 Route Handlers. Six desks, SSE streaming,
  fixture fallbacks. The brief is `backend/docs/Backend.md`. Entrypoint:
  `backend/app/api/run/route.ts`.
- **`front-end/`** — Next.js 16 / React 19 UI (mandate / run / memo screens).
- **`backend/docs/`** — original architecture brief and demo script.

The legacy Python `app/`, `tests/`, and `pyproject.toml` at the repo root
relate to an older underwriter-loan prototype and are not used by the demo.

## Cursor Cloud specific instructions

- **Node 20+** is required for `backend/` and `front-end/`. If `node` is not
  present, install it (the cloud env uses a NodeSource tarball at
  `/opt/node`). Python 3.12 is also available for the legacy scripts.
- **Backend dev**: `cd backend && npm install && npm run dev` (port 3001).
- **Backend smoke**: `cd backend && npm run smoke` (with the dev server running).
- **Backend typecheck**: `cd backend && npm run typecheck`.
- **Backend build**: `cd backend && npm run build`.
- All external APIs (Specter, Companies House, OpenSanctions, WHOIS, OpenAI)
  are optional — the backend defaults to fixtures and runs cleanly with no
  keys set. Set `DEMO_FORCE_FIXTURES=true` to skip live calls deliberately.

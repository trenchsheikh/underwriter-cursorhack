# Underwriter Backend

A FastAPI backend for a loan underwriting workflow: applicants, applications, document uploads, a transparent rule-based risk engine (with optional LLM-assisted narratives), and persisted decisions with full audit trail.

## Features

- **Auth** — JWT bearer auth (`/api/v1/auth/login`, `/api/v1/auth/token` OAuth2 password flow). Bootstrap admin is auto-created on first start.
- **Applicants** — CRUD for applicants (KYC-style fields).
- **Applications** — Loan applications tied to applicants with status lifecycle (`draft → submitted → in_review → decisioned`).
- **Documents** — Upload, list, and remove supporting documents per application (multipart/form-data).
- **Underwriting** — Rule-based risk scoring (deterministic, explainable). Optional OpenAI-assisted narrative when `OPENAI_API_KEY` is set; the LLM never changes the outcome.
- **Decisions** — Persisted decisions with risk score, approved amount, APR, machine-readable reasons, and a human-readable narrative. Underwriter overrides supported.
- **RBAC** — `admin`, `underwriter`, and `viewer` roles enforced on sensitive endpoints.
- **Ops** — Health check, structured JSON logs, CORS, Dockerfile, docker-compose with Postgres, GitHub Actions CI.

## Quick Start

### Local (SQLite)

```bash
cp .env.example .env
pip install -r requirements-dev.txt
make run
```

API: http://localhost:8000 — interactive docs at http://localhost:8000/docs

Default admin (override via env): `admin@underwriter.example` / `admin12345`.

### Docker (Postgres)

```bash
docker compose up --build
```

## API Overview

Versioned under `/api/v1`.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | JSON login → JWT |
| POST | `/auth/token` | OAuth2 password flow |
| GET | `/auth/me` | Current user |
| POST | `/auth/users` | Create user (admin) |
| POST/GET/PATCH/DELETE | `/applicants[/{id}]` | Applicant CRUD |
| POST/GET/PATCH/DELETE | `/applications[/{id}]` | Application CRUD |
| POST | `/applications/{id}/submit` | Submit application |
| POST | `/applications/{id}/evaluate` | Run underwriting (no persistence) |
| POST | `/applications/{id}/decide` | Persist decision (underwriter+) |
| GET | `/applications/{id}/decisions` | Decision history |
| POST/GET/DELETE | `/applications/{id}/documents` | Document upload + listing |

## Underwriting Engine

The engine in `app/services/underwriting/engine.py` produces a transparent score in `[0, 100]` (lower is better) using:

- Credit score band (hard floor at 580; auto-tier at 720+)
- Debt-to-income ratio (cap at 45%)
- Payment-to-income ratio (cap at 35%; reduces approved amount instead of declining where possible)
- Employment tenure
- Loan purpose risk weighting (home, auto, education < personal < business)
- Policy-max amount ($250k)

Pricing produces an APR between 3% and 36% as a function of risk score and purpose. Outcomes:
`approved`, `conditionally_approved`, `refer`, `declined`. Every decision returns a list of human-readable reasons.

If `OPENAI_API_KEY` is set, a short underwriter-style note is appended to the narrative. The LLM cannot change the outcome, amount, or APR.

## Project Layout

```
app/
  api/v1/endpoints/   FastAPI routers (auth, applicants, applications, documents, decisions)
  core/               config, logging, security (JWT + bcrypt)
  db/                 SQLAlchemy base, session, init/bootstrap
  models/             ORM models
  schemas/            Pydantic v2 schemas
  services/           business logic + underwriting engine
  main.py             FastAPI app factory
tests/                pytest suite (engine + API integration)
```

## Testing

```bash
make dev
make test
```

Tests use SQLite + FastAPI `TestClient` and cover the underwriting engine plus the end-to-end API flow.

## Configuration

All settings live in `app/core/config.py` and can be overridden via environment variables or a local `.env` file (see `.env.example`).

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./underwriter.db` | Use `postgresql+psycopg2://...` in production |
| `JWT_SECRET` | dev placeholder | **Override in any non-dev environment** |
| `JWT_EXPIRES_MINUTES` | `60` | Access token TTL |
| `OPENAI_API_KEY` | _(unset)_ | Enables LLM-assisted narratives |
| `OPENAI_MODEL` | `gpt-4o-mini` | Used only when key is present |
| `CORS_ORIGINS` | `*` | Comma-separated |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | dev defaults | Created only if no users exist |

## License

Internal hackathon project.

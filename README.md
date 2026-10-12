# ShipShape

ShipShape is the foundation for a damage-repair workflow used by field technicians and engineers.

1. A field technician reports damage and attaches photos.
2. A repair is opened from that report.
3. Engineering records a stress and strength analysis.
4. A reviewer approves the analysis, asks for changes, or rejects it.

This repository is the shared TypeScript app, validation, database schema, and the first application shell.

## Prerequisites

- Node.js 22. The version is pinned in `.nvmrc`.
- pnpm 10. The exact version is the `packageManager` field in `package.json`.
- A [Neon](https://neon.com) Postgres database when you are ready to store data.

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Put a Neon connection string in `DATABASE_URL` inside `.env.local`. That is the only environment variable. `pnpm dev`, `pnpm build`, and `GET /api/health` work before it is set. `getDb()` connects on first use. The pooled string works for the app and `pnpm db:seed`. `pnpm db:migrate` needs the direct string. See [docs/database.md](docs/database.md).

```bash
pnpm dev
```

The app is at [http://localhost:3000](http://localhost:3000). The health check is [http://localhost:3000/api/health](http://localhost:3000/api/health).

## Scripts

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Start the Next.js dev server                  |
| `pnpm build`        | Production build                              |
| `pnpm start`        | Serve the production build                    |
| `pnpm lint`         | Run ESLint                                    |
| `pnpm format`       | Rewrite files with Prettier                   |
| `pnpm format:check` | Check Prettier formatting                     |
| `pnpm typecheck`    | Generate route types, then run `tsc --noEmit` |
| `pnpm test`         | Run Vitest once                               |
| `pnpm test:watch`   | Run Vitest in watch mode                      |
| `pnpm db:generate`  | Write a SQL migration from `src/db/schema.ts` |
| `pnpm db:migrate`   | Apply migrations in `migrations/`             |
| `pnpm db:check`     | Check the migration history is consistent     |
| `pnpm db:seed`      | Insert the demo rows                          |
| `pnpm db:studio`    | Open Drizzle Studio                           |

## Project structure

```text
src/app/                  Next.js App Router pages and route handlers
src/app/api/health/       Liveness check
src/app/(app)/            Shell: dashboard, engineering, docs, tools
src/components/           Shared UI and the application header
src/features/             Page view models, demo fixtures, and derived counts
src/config/               Shared constants (margin threshold, navigation)
src/schemas/              Zod schemas shared by the UI and the server
src/schemas/documents.ts  Chunk and search shapes for reference documents
src/server/<domain>/      Server-side parsing for one workflow step
src/server/documents/     Extract, chunk, and embed uploaded documents
src/db/schema.ts          Drizzle tables
src/db/relations.ts       Drizzle relations for db.query
src/db/index.ts           Neon client. Call getDb() when you need it.
src/db/seed.ts            Demo data. One T-45 asset group.
migrations/               SQL migrations, including pgvector
drizzle.config.ts         Drizzle Kit config. Reads DATABASE_URL.
docs/database.md          Tables, migrations, and restore
```

Server domains:

| Directory                   | Workflow step                                 |
| --------------------------- | --------------------------------------------- |
| `src/server/damage-reports` | Field report with photos                      |
| `src/server/repairs`        | Repair opened from a damage report            |
| `src/server/analyses`       | Stress and strength analysis                  |
| `src/server/reviews`        | Review and approval                           |
| `src/server/documents`      | Uploaded reference documents and local search |

Import schemas from `@/schemas` in both client and server code:

```ts
import { damageReportCreateSchema, type DamageReportCreate } from "@/schemas";
```

Import server modules only from server code. They pull in `server-only`.

```ts
import { parseDamageReportCreate } from "@/server/damage-reports";
```

## Decisions

**Validation lives in one place.** Each domain has a create schema for input and a record schema for stored data. Server functions parse `unknown` input and return the typed payload. Database writes belong with the real tables.

**The database client connects on first use.** `getDb()` in `src/db/index.ts` reads `DATABASE_URL` when it is called. Importing the module is enough for a build that has no database. `drizzle.config.ts` loads `.env`, `.env.local`, and the other Next.js env files through `@next/env`.

**Tables cover the repair workflow.** `src/db/schema.ts` holds organizations, people, generic assets, issues, repairs, analyses, reviews, and documents. Assets are not aircraft-specific: `asset_type` is a free label and type-specific fields live in JSON. The table list, migration rules, and restore steps are in [docs/database.md](docs/database.md).

**Document search embeds locally and stores chunks in Postgres.** `extractText()` reads PDF with unpdf, DOCX with mammoth, and plain text or Markdown as UTF-8. `chunkText()` splits that text into overlapping chunks of about 500 tokens, keeping a page span and character offsets. `embed()` and `embedText()` are the only functions that load `Xenova/all-MiniLM-L6-v2` through Transformers.js. They mean-pool and L2-normalize to the 384-dimension vectors named by `DOCUMENT_EMBEDDING_DIMENSIONS`. `document_chunks` stores that `DocumentChunk` shape (`index`, `text`, `startOffset`, `endOffset`, `pageStart`, `pageEnd`) plus the embedding, with a cosine HNSW index. Serving search over HTTP comes later. `pnpm test` mocks the model. Set `RUN_EMBEDDING_MODEL=1` to run the optional test that downloads it.

**Dashboard and the analysis list read demo fixtures.** `getDashboard()` and `listAnalyses()` in `src/features/<domain>/data.ts` return typed view models. The pages render those objects. Swapping the fixture reads for queries later does not require a component change. Stage counts, item age, and minimum margin live in `derive.ts` and are covered by Vitest.

**Low margins use one cutoff until organizations store their own.** `LOW_MARGIN_THRESHOLD` in `src/config/analysis.ts` is `0.10`. A later setting, `organizations.low_margin_threshold`, replaces it per organization. Negative margins stay red either way.

**The tools marketplace is a coming-soon page.** `/tools` lists the planned catalog. Licensing and publishing are not wired up.

**shadcn/ui sits on the ShipShape theme.** Tailwind 4 tokens live in `src/app/globals.css`. IBM Plex Sans and IBM Plex Mono load through `next/font`. Corners are square. Warning amber is `#b07d0e` only.

## Contributing

Branch from `main`, use [Conventional Commits](https://www.conventionalcommits.org/), and open a pull request. CI runs lint, format check, typecheck, test, and build, and applies migrations to a throwaway Postgres database. It does not need secrets. A separate workflow dumps Neon and migrates it after a migration change reaches `main`.

The full workflow, commit types, and where to put code are in [CONTRIBUTING.md](CONTRIBUTING.md).

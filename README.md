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

Put a Neon connection string in `DATABASE_URL` inside `.env.local`. `pnpm dev`, `pnpm build`, and `GET /api/health` work before it is set. `getDb()` connects on first use. The pooled string works for the app and `pnpm db:seed`. `pnpm db:migrate` needs the direct string. See [docs/database.md](docs/database.md).

Uploaded files are written under `.data/documents`. Set `DOCUMENT_STORAGE_DIR` to use a different directory. Both variables are listed in `.env.example`.

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
src/app/api/documents/    Upload and search route handlers
src/app/(app)/            Shell: dashboard, engineering, docs, tools
src/components/           Shared UI and the application header
src/features/             Page view models, demo fixtures, and derived counts
src/config/               Shared constants (margin threshold, navigation, uploads)
src/schemas/              Zod schemas shared by the UI and the server
src/schemas/documents.ts  Chunk and search shapes for reference documents
src/server/<domain>/      Server-side parsing for one workflow step
src/server/documents/     Ingest, extract, chunk, embed, and search documents
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

**Document search embeds locally and stores chunks in Postgres.** `extractText()` reads PDF with unpdf, DOCX with mammoth, and plain text or Markdown as UTF-8. `chunkText()` splits that text into overlapping chunks of about 500 tokens, keeping a page span and character offsets. `embed()` and `embedText()` are the only functions that load `Xenova/all-MiniLM-L6-v2` through Transformers.js. They mean-pool and L2-normalize to the 384-dimension vectors named by `DOCUMENT_EMBEDDING_DIMENSIONS`. `document_chunks` stores that `DocumentChunk` shape (`index`, `text`, `startOffset`, `endOffset`, `pageStart`, `pageEnd`) plus the embedding, with a cosine HNSW index. `POST /api/documents` indexes an upload and `POST /api/documents/search` queries it. The request shapes, error body, and limits are in [docs/api.md](docs/api.md). `pnpm test` mocks the model. Set `RUN_EMBEDDING_MODEL=1` to run the optional test that downloads it.

**New findings are filed from the field.** `/findings/new` is linked from the shell and the dashboard. The tech picks an asset group, then an asset, and records a title, description, severity (low, medium, high, or critical), location or zone, and photos. The asset group only filters the asset list. The request sends `assetId`. Identifier and location labels come from the asset type and otherwise stay Identifier and Location. `createFinding()` posts multipart field `photos` to `POST /api/findings` with `x-org-id` from `orgId()`. Demo mode is `isDemoData()` (`NEXT_PUBLIC_DEMO_MODE` or `NEXT_PUBLIC_DOCS_DEMO_MODE`). With it on, the client returns a fake 201 and does not call `fetch`. With it off, network errors, non-2xx responses, and schema mismatches throw `FindingRequestError`. `validation_error` is “Validation error.”, `payload_too_large` and 413 are “Photo too large.”, `unsupported_media_type` and 415 are “Photo type not supported.”, `asset_not_found` is “Asset error.”, and `too_many_photos` is “Add up to 6 photos.” The same sentences cover `validation_failed`, `photo_too_large`, and `unsupported_photo_type`. Photo limits and the form schema stay in `src/features/findings/contract.ts` until `src/config/findings.ts` and `src/schemas/findings.ts` land. Severity is `SEVERITIES` from `src/config/severity.ts`, not the Drizzle enum in `src/db/schema.ts`.

**The Docs page calls the document routes.** `/docs` posts uploads to `POST /api/documents` and searches to `POST /api/documents/search`, then parses the shared schemas. A successful upload is `documentUploadResultSchema`. Both requests send `x-org-id`. `documentOrgId()` in `src/config/org.ts` is the only place that chooses it: `NEXT_PUBLIC_ORG_ID` when set, otherwise the demo-seed organization. Issue #13 replaces that with the session once auth exists. Demo results stay off unless `NEXT_PUBLIC_DOCS_DEMO_MODE` is `true`. `isDemoData()` in `src/config/demo.ts` is the only place that reads that flag. With it off, a network error, a non-2xx response, or a body that fails the schema becomes a `DocsRequestError`. Error bodies are parsed with `apiErrorSchema`. `invalid_org_id`, `unknown_organization`, 413, and 415 map to readable messages; other codes show `error.message`. With the flag on, the client returns typed demo hits and session uploads and does not call `fetch`. The drop zone imports `MAX_DOCUMENT_UPLOAD_BYTES` and the accepted types from `src/config/documents.ts` and refuses a file before upload. Results show `documentTitle`, `snippet`, and a page range when `pageStart` and `pageEnd` are set. The asset map slot stays empty.

**Dashboard and the analysis list read the database.** `getDashboard()`, `getDashboards()`, and `listAnalyses()` keep the promise signatures from the demo. `src/features/<domain>/data.ts` re-exports the database implementation; point that import at `./demo` to render the typed fixtures. When `DATABASE_URL` is unset, those readers return the fixtures so `pnpm dev` and `pnpm build` still work, and they do not connect. Pipeline counts use each issue's current stage. Open-item age and throughput use `stage_transitions`. Findings by zone group `issues.zone`. Tenant scope is `assets.org_id`. Overdue analyses use the same UTC day as the dashboard: one `readRequestClock()` call per request, or `DEMO_AS_OF` when the database is not configured. `derive.ts` still owns the bar math and is covered by Vitest.

**Low margins use the organization's cutoff.** The tenant snapshot reads `organizations.low_margin_threshold` for the oldest organization (lowest id when `created_at` ties) and falls back to `LOW_MARGIN_THRESHOLD` (`0.10`) when that row is missing or the database is not configured. The dashboard and analyses pages pass that snapshot value to `MarginValue`. Negative margins stay red either way.

**The tools marketplace is a coming-soon page.** `/tools` lists the planned catalog. Licensing and publishing are not wired up.

**shadcn/ui sits on the ShipShape theme.** Tailwind 4 tokens live in `src/app/globals.css`. IBM Plex Sans and IBM Plex Mono load through `next/font`. Corners are square. Warning amber is `#b07d0e` only.

## Contributing

Branch from `main`, use [Conventional Commits](https://www.conventionalcommits.org/), and open a pull request. CI runs lint, format check, typecheck, test, and build, and applies migrations to a throwaway Postgres database. It does not need secrets. A separate workflow dumps Neon and migrates it after a migration change reaches `main`.

The full workflow, commit types, and where to put code are in [CONTRIBUTING.md](CONTRIBUTING.md).

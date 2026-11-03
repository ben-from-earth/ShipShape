# ShipShape

ShipShape is the foundation for a damage-repair workflow used by field technicians and engineers.

1. A field technician reports damage and attaches photos.
2. A repair is opened from that report.
3. Engineering records a stress and strength analysis.
4. A reviewer approves the analysis, asks for changes, or rejects it.

This repository is the shared TypeScript app, validation, database schema, and the first application shell.

## Prerequisites

- Node.js 22. The version is pinned in `.nvmrc`. npm comes with that Node install.
- A [Neon](https://neon.com) Postgres database when you are ready to store data.

## Setup

```bash
npm install
cp .env.example .env.local
```

Put a Neon connection string in `DATABASE_URL` inside `.env.local`. `npm run dev`, `npm run build`, and `GET /api/health` work before it is set. `getDb()` connects on first use. The pooled string works for the app and `npm run db:seed`. `npm run db:migrate` needs the direct string. See [docs/database.md](docs/database.md).

Uploaded files are written under `.data/documents`. Set `DOCUMENT_STORAGE_DIR` to use a different directory. Both variables are listed in `.env.example`.

```bash
npm run dev
```

The app is at [http://localhost:3000](http://localhost:3000). The health check is [http://localhost:3000/api/health](http://localhost:3000/api/health).

## Scripts

| Script                 | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Start the Next.js dev server                  |
| `npm run build`        | Production build                              |
| `npm run start`        | Serve the production build                    |
| `npm run lint`         | Run ESLint                                    |
| `npm run format`       | Rewrite files with Prettier                   |
| `npm run format:check` | Check Prettier formatting                     |
| `npm run typecheck`    | Generate route types, then run `tsc --noEmit` |
| `npm run test`         | Run Vitest once                               |
| `npm run test:watch`   | Run Vitest in watch mode                      |
| `npm run db:generate`  | Write a SQL migration from `src/db/schema.ts` |
| `npm run db:migrate`   | Apply migrations in `migrations/`             |
| `npm run db:check`     | Check the migration history is consistent     |
| `npm run db:seed`      | Insert the demo rows                          |
| `npm run db:studio`    | Open Drizzle Studio                           |

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

| Directory              | Workflow step                                 |
| ---------------------- | --------------------------------------------- |
| `src/server/findings`  | Field issue with photos                       |
| `src/server/repairs`   | Repair opened from an issue                   |
| `src/server/analyses`  | Analysis generated from a repair              |
| `src/server/documents` | Uploaded reference documents and local search |

Import schemas from `@/schemas` in both client and server code.

Import server modules only from server code. They pull in `server-only`.

## Decisions

**Validation lives in one place.** Each domain has a create schema for input and a record schema for stored data. Server functions parse `unknown` input and return the typed payload. Database writes belong with the real tables.

**The database client connects on first use.** `getDb()` in `src/db/index.ts` reads `DATABASE_URL` when it is called. Importing the module is enough for a build that has no database. `drizzle.config.ts` loads `.env`, `.env.local`, and the other Next.js env files through `@next/env`.

**Tables cover the repair workflow.** `src/db/schema.ts` holds organizations, people, generic assets, issues, repairs, analyses, reviews, and documents. Assets are not aircraft-specific: `asset_type` is a free label and type-specific fields live in JSON. The table list, migration rules, and restore steps are in [docs/database.md](docs/database.md).

**Document search embeds locally and stores chunks in Postgres.** `extractText()` reads PDF with unpdf, DOCX with mammoth, and plain text or Markdown as UTF-8. `chunkText()` splits that text into overlapping chunks of about 500 tokens, keeping a page span and character offsets. `embed()` and `embedText()` are the only functions that load `Xenova/all-MiniLM-L6-v2` through Transformers.js. They mean-pool and L2-normalize to the 384-dimension vectors named by `DOCUMENT_EMBEDDING_DIMENSIONS`. `document_chunks` stores that `DocumentChunk` shape (`index`, `text`, `startOffset`, `endOffset`, `pageStart`, `pageEnd`) plus the embedding, with a cosine HNSW index. `POST /api/documents` indexes an upload and `POST /api/documents/search` queries it. The request shapes, error body, and limits are in [docs/api.md](docs/api.md). `npm run test` mocks the model. Set `RUN_EMBEDDING_MODEL=1` to run the optional test that downloads it.

**New issues are filed from the field.** `/issues/new` is linked from the shell and the dashboard. The tech picks an asset group, then an asset, and records a description, severity (`SEVERITIES` from `src/config/severity.ts`), an optional location or zone, and 1 to 10 photos. The asset group only filters the asset list. The request sends `assetId`, `description`, `severity`, optional `zone` and `locationLabel`, and the repeated `photos` field. It does not send a title, notes, location JSON, `reportedBy`, `discoveredAt`, or the asset group. Identifier and location labels come from the asset type and otherwise stay Identifier and Location. `createFinding()` posts to `POST /api/findings` with `x-org-id` from `orgId()` and parses `createFindingResultSchema`. Photo types, `MAX_FINDING_PHOTO_BYTES`, and `MAX_FINDING_PHOTOS` come from `src/config/findings.ts`. Demo mode is `isDemoData()` (`NEXT_PUBLIC_DEMO_MODE` or `NEXT_PUBLIC_DOCS_DEMO_MODE`). With it on, the client returns a fake 201 and does not call `fetch`. With it off, network errors, non-2xx responses, and schema mismatches throw `FindingRequestError`. `validation_error` is “Validation error.”, `payload_too_large` and 413 are “Photo too large.”, `unsupported_media_type` and 415 are “Photo type not supported.”, `asset_not_found` is “Asset error.”, and `too_many_photos` is “Add up to 10 photos.”

**The Docs page calls the document routes.** `/docs` posts uploads to `POST /api/documents` and searches to `POST /api/documents/search`, then parses the shared schemas. A successful upload is `documentUploadResultSchema`. Both requests send `x-org-id`. `documentOrgId()` in `src/config/org.ts` is the only place that chooses it: `NEXT_PUBLIC_ORG_ID` when set, otherwise the demo-seed organization. Issue #13 replaces that with the session once auth exists. Demo results stay off unless `NEXT_PUBLIC_DOCS_DEMO_MODE` is `true`. `isDemoData()` in `src/config/demo.ts` is the only place that reads that flag. With it off, a network error, a non-2xx response, or a body that fails the schema becomes a `DocsRequestError`. Error bodies are parsed with `apiErrorSchema`. `invalid_org_id`, `unknown_organization`, 413, and 415 map to readable messages; other codes show `error.message`. With the flag on, the client returns typed demo hits and session uploads and does not call `fetch`. The drop zone imports `MAX_DOCUMENT_UPLOAD_BYTES` and the accepted types from `src/config/documents.ts` and refuses a file before upload. Results show `documentTitle`, `snippet`, and a page range when `pageStart` and `pageEnd` are set. The asset map slot stays empty.

**Dashboard and the analysis list read the database.** `getDashboard()`, `getDashboards()`, and `listAnalyses()` keep the promise signatures from the demo. `src/features/<domain>/data.ts` re-exports the database implementation; point that import at `./demo` to render the typed fixtures. When `DATABASE_URL` is unset, those readers return the fixtures so `npm run dev` and `npm run build` still work, and they do not connect. Pipeline counts use each issue's current stage. Open-item age and throughput use `stage_transitions`. Findings by zone group `issues.zone`. Tenant scope is `assets.org_id`. Overdue analyses use the same UTC day as the dashboard: one `readRequestClock()` call per request, or `DEMO_AS_OF` when the database is not configured. `derive.ts` still owns the bar math and is covered by Vitest.

**The issues list and detail pages read those functions.** `/issues` filters by stage, severity, and asset through the URL. Invalid search params are dropped before `listFindings` runs. `/issues/[id]` calls `notFound()` when the id is not a uuid or `getFinding` returns null. Zone and location render a dash when the text is blank or `location` is null or empty. Photos use `/api/findings/[id]/photos/[mediaId]` and show a placeholder tile when that image fails. The storage key stays off the page. A saved finding redirects to its detail page. The finding also lists repairs from `listRepairs` filtered by that finding. Create repair on that page posts `{ title, type?, status? }` to `POST /api/findings/[id]/repairs` with `x-org-id` and parses `createRepairResultSchema`. Title is required. Type and status are optional, and status uses `repairStatusSchema`. A 404 is finding not found. A 400 `validation_error` shows field errors, and a detail whose path is `body` is a form-level error. Other failures are generic. The submit stays disabled while the request is pending. A 201 goes to `/repairs/[id]`. Demo mode is `isDemoData()` and does not call `fetch`. Stage buttons come from `allowedStageTargets`: the forward move is the primary button, and a send-back asks for confirmation before it posts. `advanceFindingStage()` posts `{ toStage }` to `POST /api/findings/[id]/stage` with `x-org-id` and parses `advanceFindingStageResultSchema` (`id`, `stage`, `transitionedAt`). The page updates from that body and refreshes. `StageRequestError` maps 404 to not found, a 422 `invalid_transition` to the server message, 409 to a conflict that refreshes, and 400 or 500 to a generic error. The buttons stay disabled while the request is pending. Demo mode is `isDemoData()`. With it on, the client updates local state and does not call `fetch`.

**Repairs have a list and a detail page.** `/repairs` and `/repairs/[id]` call `listRepairs` and `getRepair` for the oldest organization, the same tenant stand-in as findings. The list shows the repair code, the finding code, the asset, status, and the created date. The asset shows its name, or its identifier when `asset.name` is null or blank. The finding page's repairs section uses that same label. Those fields come from the join on `listRepairs` and `getRepair`. Status and finding id filters live in the URL. A value that fails `repairListFiltersSchema` is dropped before the reader runs. `/repairs/[id]` calls `notFound()` when the id is not a uuid or `getRepair` returns null. The detail links back to the finding. Demo repairs render only when `isDemoData()` is on. With the flag off and no `DATABASE_URL`, the list is empty and the detail is not found. That path does not fill in the fixture.

**Finding readers use that same tenant.** `listFindings()`, `getFinding(id)`, and `getFindingMedia(findingId, mediaId)` read `issues` through `assets.org_id` for the oldest organization (lowest id when `created_at` ties), the stand-in tracked by #13. `listFindings` filters by `stage`, `severity`, and `assetId`, and orders by `created_at` descending with `id` as the tiebreak. Photos load in one query. The record is stored columns only: no title and no notes. Current stage is `issues.stage`. A location that is not a JSON object is null. Photo metadata on the record is `mediaId`, `contentType`, `createdAt`, and `size` (null, because `issue_media` has no byte length). A mime type outside the stored list is skipped. The storage key is not on that record. `getFindingMedia` returns `{ storageKey, contentType, size }` or null for the photo route, and neither reader builds a public URL. With no `DATABASE_URL` they return the demo finding and do not connect. The shapes are `findingRecordSchema` and `findingMediaContentSchema`.

**Analyses belong to a repair.** `/analyses` lists repair-scoped analyses (margins, load cases, writer/checker roles). `/analyses/[id]` shows one stored analysis. A repair detail can generate an analysis through `POST /api/repairs/[id]/analyses`. Default checklist fields live in `src/config/analysis-fields.ts`. `/findings` and `/engineering` redirect to `/issues` and `/analyses`. The leftover standalone `engineering_analyses` table and `/api/analyses` board stay until a dedicated drop migration.

**Low margins use the organization's cutoff.** The tenant snapshot reads `organizations.low_margin_threshold` for the oldest organization (lowest id when `created_at` ties) and falls back to `LOW_MARGIN_THRESHOLD` (`0.10`) when that row is missing or the database is not configured. The dashboard and analyses pages pass that snapshot value to `MarginValue`. Negative margins stay red either way.

**The tools marketplace is a coming-soon page.** `/tools` lists the planned catalog. Licensing and publishing are not wired up.

**shadcn/ui sits on the ShipShape theme.** Tailwind 4 tokens live in `src/app/globals.css`. IBM Plex Sans and IBM Plex Mono load through `next/font`. Corners are square. Warning amber is `#b07d0e` only.

## Contributing

Branch from `main`, use [Conventional Commits](https://www.conventionalcommits.org/), and open a pull request. CI runs lint, format check, typecheck, test, and build, and applies migrations to a throwaway Postgres database. It does not need secrets. A separate workflow dumps Neon and migrates it after a migration change reaches `main`.

The full workflow, commit types, and where to put code are in [CONTRIBUTING.md](CONTRIBUTING.md).

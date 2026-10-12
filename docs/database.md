# Database

ShipShape stores the repair workflow in Postgres. Production is Neon. Document search needs the `vector` extension (pgvector). Assets are generic: `asset_type` is a free label and type-specific facts live in JSON. A T-45 group in the demo seed is sample data, not a schema rule.

`getDb()` uses the Neon HTTP driver and connects on first use. Importing `src/db` does not require `DATABASE_URL`.

## Tables

Seventeen tables. Drizzle relations in `src/db/relations.ts` back `getDb().query`.

| Table               | Purpose                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `organizations`     | Tenant. Holds the low-margin threshold used by the dashboard.                                                                                                                                                            |
| `users`             | Person in an organization, with one role. Email is unique.                                                                                                                                                               |
| `asset_groups`      | Named set of repairable things, with a free `asset_type`.                                                                                                                                                                |
| `assets`            | One repairable thing. Identifier is unique per organization. `attributes` holds type-specific fields. `out_of_service` is a boolean.                                                                                     |
| `issues`            | Field damage report. `stage` moves from `discovered` through `closed`. `severity` is required (`low`, `medium`, `high`, `critical`). `location` is structured JSON; `location_label` is the human text.                  |
| `issue_media`       | File pointer for a photo or other attachment. Bytes stay in object storage.                                                                                                                                              |
| `repairs`           | Repair opened from an issue.                                                                                                                                                                                             |
| `repair_revisions`  | One revision of a repair (`A`, `B`, …). Unique per repair.                                                                                                                                                               |
| `analyses`          | Engineering analysis of one repair revision, with status and owner.                                                                                                                                                      |
| `analysis_people`   | Analyst, checker, and approver assignments. One person can hold more than one role.                                                                                                                                      |
| `analysis_cases`    | One margin-of-safety case. The dashboard minimum is `MIN(margin)` per analysis.                                                                                                                                          |
| `tool_runs`         | Saved tool run (for example layer loads). Inputs and outputs are JSON tied to `tool_version`.                                                                                                                            |
| `reviews`           | Approval decision on an analysis.                                                                                                                                                                                        |
| `stage_transitions` | Append-only stage history for time-in-stage, cycle time, and open-item age.                                                                                                                                              |
| `activity_log`      | Append-only activity feed.                                                                                                                                                                                               |
| `documents`         | Uploaded reference file and its indexing status.                                                                                                                                                                         |
| `document_chunks`   | Chunk text plus a 384-dimension L2-normalized embedding from all-MiniLM-L6-v2. Cosine HNSW index on `embedding`. Columns match `DocumentChunk`: `index`, `text`, `start_offset`, `end_offset`, `page_start`, `page_end`. |

Issues, repairs, and analyses have no `org_id`. Tenant scoping for those rows goes through `assets.org_id`: an issue belongs to its asset, a repair to its issue, and an analysis to its repair revision.

## Issue codes

`issues.code` is unique across every organization. The demo seed uses `ISS-1001`. New codes come from the Postgres sequence `issue_code_seq` in `src/db/schema.ts`.

`nextIssueCode(db)` returns the next code. `nextIssueCodeSql()` is that same allocation as a scalar SQL expression, so it can be the `code` value of an insert inside `db.batch`. Both call `nextval` once. The format matches the seed: the prefix `ISS-`, then the decimal integer padded to at least four digits. A longer integer is not truncated.

| Sequence value | Code        |
| -------------- | ----------- |
| 1001 (seed)    | `ISS-1001`  |
| 1002           | `ISS-1002`  |
| 10000          | `ISS-10000` |

The sequence is created with `START WITH 1002`. Migration `0001_issue_code_seq` then runs `setval` to the greater of `1001` and the highest existing `ISS-` number. The next `nextval` is that value plus one, so it does not collide with the seed row or with a higher code already stored. Overlapping calls receive different values. A rolled-back transaction does not put its value back.

```ts
import { getDb } from "@/db";
import { nextIssueCode, nextIssueCodeSql } from "@/db/issue-code";
import { issues } from "@/db/schema";

const code = await nextIssueCode(getDb());

const db = getDb();
await db.batch([
  db.insert(issues).values({
    code: nextIssueCodeSql(),
    assetId,
    severity: "high",
    description,
  }),
]);
```

`src/db/issue-code.integration.test.ts` checks concurrent calls against a loopback database only. CI runs it on the `pgvector/pgvector:pg17` service after migrations are applied. `openIntegrationDatabase` refuses any host that is not loopback, so a Neon URL is never opened.

## Issue severity

`issues.severity` is required. The values live in `src/config/severity.ts` as `SEVERITIES`: `low`, `medium`, `high`, `critical`. That file imports nothing, so client code can use it. `issueSeverity` in `src/db/schema.ts` is `pgEnum("issue_severity", SEVERITIES)`. The database module does not export a second copy of the list.

Migration `0002_issue_severity` adds the column as `NOT NULL DEFAULT 'medium'`, which backfills every existing row, then drops the default. Inserts after that must set `severity`. The demo seed sets the canopy-sill crack to `high`. A row that already existed when the migration ran stays `medium`; seeding again does not overwrite it.

## Finding readers

`listFindings`, `getFinding`, and `getFindingMedia` live in `src/features/findings/db.ts`. `src/features/findings/data.ts` re-exports them. With no `DATABASE_URL` they return the demo canopy-sill finding and do not connect.

The organization is the oldest row in `organizations` (lowest id when `created_at` ties). That is the same stand-in the dashboard uses until a session exists (#13). Issues have no `org_id`. Every finding query joins `assets` and keeps `assets.org_id` in the filter, including the photo query.

`listFindings` takes optional `stage`, `severity`, and `assetId`. `stage` is `findingStageSchema`. `severity` is `findingSeveritySchema`, which is `z.enum(SEVERITIES)`. Rows are ordered by `issues.created_at` descending, then `issues.id` descending. Photos for those issues load in one query (`created_at` ascending, then `id` ascending).

A finding record is the `issues` columns the product stores: `id`, `code`, `assetId`, `description`, `severity`, `stage`, `zone`, `locationLabel`, `location`, and `createdAt`. There is no title column and no notes column, so the record does not invent them. `stage` is the `issues.stage` column. The dashboard pipeline counts that column. `stage_transitions` is the history used for age and throughput. A transition that was not copied onto the column does not replace it. The asset summary is `id`, `identifier`, `name`, and the asset group (`id` and `name`, or null when the asset has no group in this organization).

Each photo is `issue_media` metadata: `mediaId` (the row `id`), `storageKey`, `contentType` (`mime_type`), `createdAt`, and `size`. The table has no byte-length column, so `size` is null. The reader does not load file bytes and does not build a public URL.

`getFinding` returns null when the id is missing or the issue's asset belongs to another organization. `getFindingMedia(findingId, mediaId)` returns `{ storageKey, contentType, size }` or null when that media row is not on that finding, or the finding is outside the organization.

`src/features/findings/readers.integration.test.ts` runs in CI against the loopback `pgvector/pgvector:pg17` service after migrations. `openIntegrationDatabase` refuses any host that is not loopback.

`updated_at` is `now()` in the database, and Drizzle refreshes it on update. Append-only tables (`stage_transitions`, `activity_log`) and rows that are replaced as a set (`analysis_people`, `document_chunks`) do not have it. A raw SQL update does not touch `updated_at`.

## Migration workflow

Schema lives in `src/db/schema.ts`. SQL lives in `migrations/`. `drizzle.config.ts` reads `DATABASE_URL` from the Next.js env files.

`pnpm db:generate` and `pnpm db:check` need `DATABASE_URL` to be set because the config file requires it. They do not connect. `pnpm db:migrate` does connect, and it needs the **direct** Neon connection string (host without `-pooler`). `pg` is installed so Drizzle Kit uses a Postgres session for that command. `getDb()` and `pnpm db:seed` use the Neon HTTP driver and accept the pooled string.

1. Edit `src/db/schema.ts`.
2. Run `pnpm db:generate` and read the new SQL. The first migration already starts with `CREATE EXTENSION IF NOT EXISTS vector`. Drizzle Kit does not emit that statement; if you regenerate from an empty `migrations/` folder, put it back at the top of the first file, with a statement breakpoint after it.
3. Run `pnpm db:check`.
4. Open a pull request. CI applies the migrations to a throwaway `pgvector/pgvector:pg17` database and fails if `drizzle-kit generate` would write a new diff. Pull requests do not get Neon credentials.

After the pull request merges to `main`, `.github/workflows/migrate.yml` runs when `migrations/` changes (and on manual dispatch). It dumps the Neon database with `pg_dump` from the `postgres:17` image, uploads that dump as an artifact kept for 30 days, and only then runs `pnpm db:migrate`. The GitHub secret `DATABASE_URL` must be the direct connection string. The workflow uses a single concurrency group so two migrations never run at once. It does not wait on a manual approval environment.

`pnpm db:seed` loads one demo organization, a T-45 asset group, and a short issue-to-review chain. Running it again does not duplicate those rows.

## Destructive changes

A pull request that **drops or renames** a table or column contains only that change, and the description says so at the top. Do not mix a drop or rename with a feature. Adding a nullable column or a new table can ride along with the feature that needs it.

Take the dump artifact from the previous production migrate (or confirm a Neon point-in-time timestamp) before merging a destructive change.

## Restore

The migrate workflow's artifact is named `neon-pre-migrate-<git sha>`. It is a `pg_dump` custom-format archive taken **before** that migration. Restoring it returns the database to that moment and discards writes made after the dump, including the migration itself.

Use a PostgreSQL 17 client, and a direct Neon connection string:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="$DATABASE_URL" neon-pre-migrate.dump
```

`--clean` drops objects before recreating them. Confirm the artifact's commit is the migration you mean to undo.

Neon also keeps a history window on the branch. If the artifact has expired, or you need a time between migrations, use the Neon console's point-in-time restore (or branch from a timestamp). Restoring replaces branch data. Pick the timestamp from the migrate workflow run you want to undo, and prefer branching first when you need to inspect the old data without overwriting the current branch.

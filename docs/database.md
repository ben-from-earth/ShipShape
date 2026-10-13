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
| `repairs`           | Repair opened from an issue. `code` is `REP-` plus a sequence number. `status` is `open`, `in_review`, or `completed`. Creating a repair does not change the issue's stage.                                              |
| `repair_revisions`  | One revision of a repair (`A`, `B`, …). Unique per repair.                                                                                                                                                               |
| `analyses`          | Engineering analysis of one repair revision. `code` is `AN-` plus a sequence number. Margin of safety is on `analysis_cases`, which the dashboard classifies against `low_margin_threshold`.                             |
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

`src/db/issue-code.integration.test.ts` checks concurrent calls against a loopback database only. CI runs it on the `pgvector/pgvector:pg18` service after migrations are applied. `openIntegrationDatabase` refuses any host that is not loopback, so a Neon URL is never opened.

## Issue severity

`issues.severity` is required. The values live in `src/config/severity.ts` as `SEVERITIES`: `low`, `medium`, `high`, `critical`. That file imports nothing, so client code can use it. `issueSeverity` in `src/db/schema.ts` is `pgEnum("issue_severity", SEVERITIES)`. The database module does not export a second copy of the list.

Migration `0002_issue_severity` adds the column as `NOT NULL DEFAULT 'medium'`, which backfills every existing row, then drops the default. Inserts after that must set `severity`. The demo seed sets the canopy-sill crack to `high`. A row that already existed when the migration ran stays `medium`; seeding again does not overwrite it.

## Repair codes

`repairs.code` is unique across every organization. The demo seed uses `REP-1001`. New codes come from the Postgres sequence `repair_code_seq` in `src/db/schema.ts`.

`nextRepairCodeSql()` is the allocation as a scalar SQL expression. `createRepair` puts that expression in the `INSERT ... SELECT`, so `nextval` runs only when the finding's asset belongs to the organization. The format is the prefix `REP-`, then the decimal integer padded to at least four digits. A longer integer is not truncated.

| Sequence value | Code        |
| -------------- | ----------- |
| 1001 (seed)    | `REP-1001`  |
| 1002           | `REP-1002`  |
| 10000          | `REP-10000` |

The sequence is created with `START WITH 1002`. Migration `0003_repair_codes` then runs `setval` to the greater of `1001` and the highest existing repair code whose text is a letter prefix, a hyphen, and digits (`REP-4242`, and older `RPR-1001` rows). The next `nextval` is that value plus one. Overlapping calls receive different values. A rolled-back transaction does not put its value back.

## Repairs

`createRepair`, `getRepair`, and `listRepairs` live in `src/features/repairs/data.ts`. Repairs have no `org_id`. Every query joins `issues` to `assets` and keeps `assets.org_id` in the filter.

`createRepair({ orgId, findingId, actorId, title, type?, status? })` inserts one row. `type` is an optional free label. `status` defaults to `open`. `actorId` is `string | null` and is stored as `created_by`. Null is written as NULL. That is the stand-in until a session exists (#13): there is no signed-in user yet, so the caller passes null. A non-null value that is not a UUID throws. A UUID that is not a user fails the foreign key and rolls the insert back. The finding check is the insert's `SELECT`: a missing finding or a finding in another organization returns `{ kind: "not_found" }` and writes nothing. A successful result is `{ kind: "ok", repair }`. The repair record is `id`, `code`, `findingId` (`issue_id`), `title`, `type`, `status`, `createdBy`, `createdAt`, `updatedAt`, plus `finding` (`id`, `code`) and `asset` (`id`, `identifier`, `name`). `name` is null when the asset has no name. Those two objects are not columns on `repairs`. The insert reads the new repair from `RETURNING` and the finding and asset from the join of rows that already existed, in the same statement. It has no storage key.

Creating a repair does not change `issues.stage` and does not write `stage_transitions`. The finding stays where it is until something calls `advanceStage`.

`getRepair(orgId, id)` returns the record or null. `listRepairs(orgId, filters?)` takes optional `findingId` and `status`. Each call is one query: `repairs` joined to `issues` joined to `assets`, with `assets.org_id` in the filter. The select includes `issues.code` and the asset `id`, `identifier`, and `name`, so the finding and asset are not loaded with a follow-up query. Rows are ordered by `repairs.created_at` descending, then `repairs.id` descending. A repair whose finding is in another organization is absent from both.

`src/features/repairs/data.integration.test.ts` runs in CI against the loopback `pgvector/pgvector:pg18` service after migrations.

Migration `0003_repair_codes` adds `repairs.status` as `NOT NULL DEFAULT 'open'`, which backfills every existing row and stays the default for inserts that omit it. It adds nullable `created_by`, an index on `issue_id`, and `repair_code_seq`. It does not drop or rename a column.

## Analysis codes

`analyses.code` is unique across every organization. The demo seed uses `AN-1001`. New codes come from the Postgres sequence `analysis_code_seq` in `src/db/schema.ts`.

`nextAnalysisCodeSql()` is the allocation as a scalar SQL expression. `createAnalysis` puts that expression in the analysis `INSERT ... SELECT`, after the repair has been limited to the organization, so `nextval` runs only when that repair's asset belongs to the organization. A missing repair and a repair in another organization both write nothing and consume no code. The format matches the seed: the prefix `AN-`, then the decimal integer padded to at least four digits. A longer integer is not truncated.

| Sequence value | Code       |
| -------------- | ---------- |
| 1001 (seed)    | `AN-1001`  |
| 1002           | `AN-1002`  |
| 10000          | `AN-10000` |

The sequence is created with `START WITH 1002`. Migration `0004_analysis_codes` then runs `setval` to the greater of `1001` and the highest existing analysis code whose text is a letter prefix, a hyphen, and digits (`AN-4242`, and an older prefix such as `XYZ-1001`). The next `nextval` is that value plus one. Overlapping calls receive different values. A rolled-back transaction does not put its value back.

## Analyses

`createAnalysis` and `getAnalysis` live in `src/features/analyses/write.ts` and are re-exported from `src/features/analyses/data.ts`. `listAnalyses` and `getAnalysesPage` stay the readers from `src/features/analyses/db.ts` (the demo switch). Analyses have no `org_id`. Every query joins `repair_revisions` to `repairs` to `issues` to `assets` and keeps `assets.org_id` in the filter.

`createAnalysis({ orgId, repairId, actorId, title, method?, loadCase?, margin, status?, dueDate?, revision? }, db?)` inserts one analysis and one `analysis_cases` row. The analysis hangs off `repair_revision_id`. The revision letter is stored in `repair_revisions.rev` (default `A`). The repair check, the revision, the analysis, and the case are one statement, because Neon HTTP has no interactive transaction. A missing repair or a repair in another organization returns `{ kind: "not_found" }`.

The revision insert is `ON CONFLICT (repair_id, rev) DO UPDATE SET rev = EXCLUDED.rev`, matching the unique index `repair_rev_uq`. `DO UPDATE` returns the existing row, so two first creates that race on the same repair and letter both succeed and share that one revision. The `SET` clause names only `rev`, and sets it to the same value. `updated_at`, `created_by`, `detail`, and `created_at` stay as they were. `repair_revisions` has no trigger. `updated_at` changes when Drizzle's `$onUpdate` hook runs, and this statement is raw SQL, so the hook does not run.

Postgres uses one snapshot for the whole statement, so a row inserted here is not visible to a later join of that table. The analysis insert takes the revision id from the revision command's `RETURNING`, and the final select takes `repair_id` from that same `RETURNING`. It does not read `repair_revisions`, `analyses`, or `analysis_cases` again. `nextval` stays in the analysis insert, so an empty repair check consumes no code.

`margin` is a number stored on `analysis_cases.margin` (`numeric(8, 3)`). `readAnalyses` and `readDashboard` already classify that column with `classifyMargin` against `organizations.low_margin_threshold` (`getLowMarginThreshold`, default `0.10`). `loadCase` is the case name and defaults to `Primary`. `method` is an optional free label. `status` defaults to `draft` (`draft`, `in_progress`, `in_review`, `changes_requested`, `approved`). `dueDate` is an optional calendar day.

`actorId` is `string | null` and is stored as `analyses.created_by`. Null is written as NULL. That is the stand-in until a session exists (#13): there is no signed-in user yet, so the caller passes null. A non-null value that is not a UUID throws. A UUID that is not a user fails the foreign key and rolls the insert back. `owner_id` stays a separate assignment.

A successful result is `{ kind: "ok", analysis }`. The analysis record is `id`, `code`, `repairId`, `revisionId`, `revision`, `title`, `method`, `loadCase`, `margin`, `status`, `createdBy`, `dueDate`, `createdAt`, and `updatedAt`. It has no storage key.

Creating an analysis does not change `issues.stage` and does not write `stage_transitions`. The finding stays where it is until something calls `advanceStage`.

`getAnalysis(orgId, id, db?)` returns the record or null. The margin and load case are the lowest `analysis_cases.margin` for that analysis, the same minimum the dashboard uses. An analysis whose repair belongs to another organization is null.

`src/features/analyses/write.integration.test.ts` runs in CI against the loopback `pgvector/pgvector:pg18` service after migrations.

Migration `0004_analysis_codes` adds nullable `analyses.created_by`, the index `analyses_revision_idx` on `repair_revision_id` (analyses reference a repair through that foreign key), and `analysis_code_seq`. It backfills the sequence with `setval` past existing prefix-digit codes, with a floor of `1001`. `analyses.status` and `analyses.code` already existed. The migration does not drop or rename a column.

## Finding readers

`listFindings`, `getFinding`, and `getFindingMedia` live in `src/features/findings/db.ts`. `src/features/findings/data.ts` re-exports them. With no `DATABASE_URL` they return the demo canopy-sill finding and do not connect.

The organization is the oldest row in `organizations` (lowest id when `created_at` ties). That is the same stand-in the dashboard uses until a session exists (#13). Issues have no `org_id`. Every finding query joins `assets` and keeps `assets.org_id` in the filter, including the photo query.

`listFindings` takes optional `stage`, `severity`, and `assetId`. `stage` is `findingStageSchema`. `severity` is `findingSeveritySchema`, which is `z.enum(SEVERITIES)`. Rows are ordered by `issues.created_at` descending, then `issues.id` descending. Photos for those issues load in one query (`created_at` ascending, then `id` ascending).

A finding record is the `issues` columns the product stores: `id`, `code`, `assetId`, `description`, `severity`, `stage`, `zone`, `locationLabel`, `location`, and `createdAt`. There is no title column and no notes column, so the record does not invent them. `stage` is the `issues.stage` column. The dashboard pipeline counts that column. `stage_transitions` is the history used for age and throughput. A transition that was not copied onto the column does not replace it. `location` is that jsonb value when it is an object, including `{}`. A value that is not an object becomes null and the reader logs a warning. The asset summary is `id`, `identifier`, `name`, and the asset group (`id` and `name`, or null when the asset has no group in this organization).

Each photo on a finding record is `mediaId` (the `issue_media` row `id`), `contentType` (`mime_type`), `createdAt`, and `size`. The table has no byte-length column, so `size` is null. A mime type outside the stored photo list is left off the record, with a warning, so one bad row does not fail the list. The storage key is not on that record, because finding records are read by pages and client components. The reader does not load file bytes and does not build a public URL.

`getFinding` returns null when the id is missing or the issue's asset belongs to another organization. `getFindingMedia(findingId, mediaId)` returns `{ storageKey, contentType, size }` or null when that media row is not on that finding, or the finding is outside the organization.

`src/features/findings/readers.integration.test.ts` runs in CI against the loopback `pgvector/pgvector:pg18` service after migrations. `openIntegrationDatabase` refuses any host that is not loopback.

`updated_at` is `now()` in the database, and Drizzle refreshes it on update. Append-only tables (`stage_transitions`, `activity_log`) and rows that are replaced as a set (`analysis_people`, `document_chunks`) do not have it. A raw SQL update does not touch `updated_at`.

## Stage advances

`advanceStage({ orgId, findingId, toStage, actorId })` lives in `src/features/findings/advance-stage.ts`. It reads `issues.stage` through `assets.org_id`, checks the move, then updates that column and inserts `stage_transitions` in one statement. Neon HTTP has no interactive transaction, so the insert selects from the update's returned rows. When the update matches nothing, no history row is written.

Allowed moves are defined once in `src/config/workflow.ts`, which does not import the database. The default is the next `work_stage` value: `discovered` → `repair_defined` → `analysis` → `review` → `approved` → `closed`. Two rework send-backs are also allowed: `review` → `analysis` (the approve step sends the finding back) and `analysis` → `repair_defined` (analysis sends the repair definition back). `approved` only moves to `closed`. `closed` has nowhere to go. The same stage, an unknown stage, and any other skip are `invalid_transition` and do not write.

A finding in another organization, or a missing id, is `not_found`. If the stage changes between the read and the guarded update, the result is `conflict` and the history table is unchanged. The update sets `updated_at` to `now()` itself, because a raw statement does not run Drizzle's `updated_at` hook. `actorId` may be null until #13 (session auth), matching `uploadedBy`. Null is written to `stage_transitions.changed_by`. A non-null `actorId` must be a real user; a foreign-key failure rolls the stage change back with the insert.

## Migration workflow

Schema lives in `src/db/schema.ts`. SQL lives in `migrations/`. `drizzle.config.ts` reads `DATABASE_URL` from the Next.js env files.

`pnpm db:generate` and `pnpm db:check` need `DATABASE_URL` to be set because the config file requires it. They do not connect. `pnpm db:migrate` does connect, and it needs the **direct** Neon connection string (host without `-pooler`). `pg` is installed so Drizzle Kit uses a Postgres session for that command. `getDb()` and `pnpm db:seed` use the Neon HTTP driver and accept the pooled string.

1. Edit `src/db/schema.ts`.
2. Run `pnpm db:generate` and read the new SQL. The first migration already starts with `CREATE EXTENSION IF NOT EXISTS vector`. Drizzle Kit does not emit that statement; if you regenerate from an empty `migrations/` folder, put it back at the top of the first file, with a statement breakpoint after it.
3. Run `pnpm db:check`.
4. Open a pull request. CI applies the migrations to a throwaway `pgvector/pgvector:pg18` database and fails if `drizzle-kit generate` would write a new diff. Pull requests do not get Neon credentials.

After the pull request merges to `main`, `.github/workflows/migrate.yml` runs when `migrations/` changes (and on manual dispatch). It dumps the Neon database with `pg_dump` from the `postgres:18` image, uploads that dump as an artifact kept for 30 days, and only then runs `pnpm db:migrate`. The GitHub secret `DATABASE_URL` must be the direct connection string. The workflow uses a single concurrency group so two migrations never run at once. It does not wait on a manual approval environment.

`pnpm db:seed` loads one demo organization, a T-45 asset group, and a short issue-to-review chain. Running it again does not duplicate those rows.

## Destructive changes

A pull request that **drops or renames** a table or column contains only that change, and the description says so at the top. Do not mix a drop or rename with a feature. Adding a nullable column or a new table can ride along with the feature that needs it.

Take the dump artifact from the previous production migrate (or confirm a Neon point-in-time timestamp) before merging a destructive change.

## Restore

The migrate workflow's artifact is named `neon-pre-migrate-<git sha>`. It is a `pg_dump` custom-format archive taken **before** that migration. Restoring it returns the database to that moment and discards writes made after the dump, including the migration itself.

Use a PostgreSQL 18 client, and a direct Neon connection string:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="$DATABASE_URL" neon-pre-migrate.dump
```

`--clean` drops objects before recreating them. Confirm the artifact's commit is the migration you mean to undo.

Neon also keeps a history window on the branch. If the artifact has expired, or you need a time between migrations, use the Neon console's point-in-time restore (or branch from a timestamp). Restoring replaces branch data. Pick the timestamp from the migrate workflow run you want to undo, and prefer branching first when you need to inspect the old data without overwriting the current branch.

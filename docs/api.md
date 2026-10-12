# Document API

Upload a reference file and search its chunks. Both routes run on the Node.js runtime, which is the App Router default. This app enables `cacheComponents`, and that setting rejects an explicit `runtime` segment config, so the handlers do not set one. Send the organization on every request:

```http
x-org-id: <organization uuid>
```

`x-org-id` is a temporary stand-in until requests carry a session. It must be a UUID for an organization that already exists. Documents belong to that organization. Search never returns another organization's chunks, including when `documentId` is set.

Allowed types and the size cap live in `src/config/documents.ts` (`DOCUMENT_UPLOAD_TYPES`, `DOCUMENT_UPLOAD_EXTENSIONS`, `DOCUMENT_UPLOAD_MEDIA_TYPES`, `MAX_DOCUMENT_UPLOAD_BYTES`). The server imports those constants. A client can import them too.

| Extension          | Media types the client may send                                           | Stored as         |
| ------------------ | ------------------------------------------------------------------------- | ----------------- |
| `.pdf`             | `application/pdf`                                                         | `application/pdf` |
| `.docx`            | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | the same          |
| `.txt`             | `text/plain`                                                              | `text/plain`      |
| `.md`, `.markdown` | `text/markdown`, `text/x-markdown`, `application/markdown`                | `text/markdown`   |

The extension and the media type have to agree. A charset parameter is ignored (`text/plain; charset=utf-8`). Files larger than 10 MB (`MAX_DOCUMENT_UPLOAD_BYTES`) are rejected.

## POST /api/documents

`multipart/form-data`.

| Field        | Required | Meaning                                     |
| ------------ | -------- | ------------------------------------------- |
| `file`       | yes      | PDF, DOCX, TXT, or Markdown                 |
| `title`      | no       | Defaults to the file name, 1–200 characters |
| `uploadedBy` | no       | User UUID in the organization               |

The handler checks the type and size, extracts text, chunks it, and embeds the chunks **before** writing. It then stores the bytes through the storage adapter and inserts the `documents` row and its `document_chunks` in one Neon `db.batch` transaction. The row's `storage_key` is the key the adapter returns. If embedding fails, nothing is stored. If the insert fails, the stored file is deleted.

`201` body (`documentUploadResultSchema`):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "orgId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Hull notes",
  "mediaType": "text/plain",
  "storageKey": "550e8400-e29b-41d4-a716-446655440000/550e8400-e29b-41d4-a716-446655440010",
  "status": "indexed",
  "chunkCount": 4
}
```

Local development writes files under `.data/documents`, or `DOCUMENT_STORAGE_DIR` when that is set. Replacing `createLocalDiskStorage()` with another `ObjectStorage` (`put`, `get`, `delete`) does not change the route.

## POST /api/documents/search

`Content-Type: application/json`. The body is `documentSearchQuerySchema`:

```json
{
  "query": "crack along the weld",
  "limit": 10,
  "documentId": "550e8400-e29b-41d4-a716-446655440010"
}
```

`query` is required (1–2000 characters). `limit` defaults to 10 and cannot exceed 50. `documentId` is optional.

The handler embeds the query and ranks chunks by pgvector cosine distance (`<=>`). `score` is `1 - distance`. The organization filter is that organization's document ids, applied on `document_chunks`, so the HNSW scan can see it. In the same transaction the search runs `SET LOCAL hnsw.iterative_scan = relaxed_order` (pgvector 0.8 or newer). The scan keeps going until `limit` rows match, including when closer chunks belong to another organization. Relaxed order is not strict, so the query sorts by distance again and the handler sorts once more before responding. `snippet` is `chunk.text` trimmed to about 300 characters on a word boundary. `documentTitle` comes from the parent document.

`200` body (`documentSearchResultSchema`):

```json
{
  "query": "crack along the weld",
  "hits": [
    {
      "documentId": "550e8400-e29b-41d4-a716-446655440010",
      "documentTitle": "Hull notes",
      "snippet": "The plate is cracked along the weld.",
      "score": 0.82,
      "chunk": {
        "index": 0,
        "text": "The plate is cracked along the weld.",
        "startOffset": 0,
        "endOffset": 38,
        "pageStart": 2,
        "pageEnd": 2
      }
    }
  ]
}
```

`pageStart` and `pageEnd` are null together for text and DOCX.

## Errors

Failures use `apiErrorSchema`:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "query",
        "message": "Too small: expected string to have >=1 characters"
      }
    ]
  }
}
```

`details` is optional. It lists field problems for a 400. Other failures omit it.

| HTTP | `error.code`             | When                                                                                                   |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| 400  | `invalid_org_id`         | `x-org-id` is missing or not a UUID                                                                    |
| 400  | `unknown_organization`   | `x-org-id` is a UUID and no organization has that id                                                   |
| 400  | `validation_error`       | Bad JSON, missing file, empty file, unreadable file, or unknown uploader                               |
| 413  | `payload_too_large`      | File or `Content-Length` is over 10 MB                                                                 |
| 415  | `unsupported_media_type` | Extension or media type is not in the upload list, or they disagree                                    |
| 500  | `internal_error`         | Anything else. `message` is `Something went wrong.` The response does not include the underlying error |

## Tests

`pnpm test` mocks `embed()` and the database. It does not read `DATABASE_URL` and does not connect to Neon.

The pgvector integration test is skipped unless `SHIPSHAPE_INTEGRATION_DATABASE_URL` is set. That URL must be a normal Postgres connection string, not a `neon.tech` host. CI sets it to the `pgvector/pgvector:pg17` service after `0000_initial` is applied, and runs `src/server/documents/search.integration.test.ts` there. The test still mocks the embedding model and checks cosine order, organization scope, snippets, and a full page for a small organization beside a larger one against the real `vector(384)` column.

# Findings API

A finding is an `issues` row: damage a field technician reports on an asset, plus the photos stored as `issue_media`. Assets are any repairable thing. `asset_type` is a free label, and nothing in this contract is specific to one kind of asset.

`POST /api/findings` is implemented by `src/app/api/findings/route.ts`. It writes the `issues` row, its `issue_media` rows, and the initial `stage_transitions` row. A database or storage failure is an error response. The route does not substitute demo data.

Send the organization on the request:

```http
x-org-id: <organization uuid>
```

`x-org-id` is a temporary stand-in until requests carry a session (#13). It must be a UUID for an organization that already exists. Document routes use the same header (`ORG_ID_HEADER` in `src/config/org.ts`).

Issues have no `org_id`. The asset must belong to that organization (`assets.org_id`). An id that is missing, or that belongs to another organization, is `asset_not_found`. The response does not say which of those two it was.

Photo types, the size cap, and the text limits live in `src/config/findings.ts` (`FINDING_PHOTO_TYPES`, `FINDING_PHOTO_EXTENSIONS`, `FINDING_PHOTO_MEDIA_TYPES`, `MAX_FINDING_PHOTO_BYTES`, `MIN_FINDING_PHOTOS`, `MAX_FINDING_PHOTOS`). The server imports those constants. A client can import them too.

| Extension       | Media types the client may send | Stored as    |
| --------------- | ------------------------------- | ------------ |
| `.jpg`, `.jpeg` | `image/jpeg`, `image/jpg`       | `image/jpeg` |
| `.png`          | `image/png`                     | `image/png`  |
| `.webp`         | `image/webp`                    | `image/webp` |
| `.heic`         | `image/heic`                    | `image/heic` |
| `.heif`         | `image/heif`                    | `image/heif` |

HEIC and HEIF are accepted because phone cameras still produce them. The bytes are stored as uploaded. This contract does not transcode them.

The extension and the media type have to agree, and both have to be on the list. They agree when they name the same stored type (`findingPhotoMediaTypeForExtension` and `canonicalFindingPhotoMediaType`). A parameter such as charset is ignored (`image/jpeg; charset=binary`). Each photo must be non-empty and at most 15 MB (`MAX_FINDING_PHOTO_BYTES`). A finding accepts 1 to 10 photos.

## POST /api/findings

`multipart/form-data`. Text values are named form fields. Photos are the repeated file field `photos`. There is no JSON part named `fields`.

The intake form (PR #15) uses these names for the columns that exist. Its asset-group control is only a filter: the request has `assetId`, and the handler reads `assets.group_id` from that asset. Do not send `groupId`, `assetGroup`, or `assetGroupId`.

| Field           | Required | Column                  | Meaning                                                                                                                                                                                                 |
| --------------- | -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assetId`       | yes      | `issues.asset_id`       | Asset UUID in the organization. The form calls this the asset                                                                                                                                           |
| `description`   | yes      | `issues.description`    | What was found, 1–5000 characters. This is the write-up; there is no notes field                                                                                                                        |
| `severity`      | yes      | `issues.severity`       | `low`, `medium`, `high`, or `critical`. `findingSeveritySchema` is `z.enum(SEVERITIES)` from `src/config/severity.ts`, the same list as the `issue_severity` enum                                       |
| `zone`          | no       | `issues.zone`           | The form's zone, 1–200 characters. Meaning depends on the asset type                                                                                                                                    |
| `locationLabel` | no       | `issues.location_label` | The form's location text, 1–200 characters                                                                                                                                                              |
| `location`      | no       | `issues.location`       | JSON object. `JSON.stringify` of the parsed object is at most 2000 characters. A multipart string longer than that is rejected before parse. The form does not send this. An array or other value fails |
| `reportedBy`    | no       | `issues.reported_by`    | User UUID in the organization. The form does not send this                                                                                                                                              |
| `discoveredAt`  | no       | `issues.discovered_at`  | ISO-8601 timestamp with an offset. The form does not send this                                                                                                                                          |
| `photos`        | yes      | `issue_media`           | 1–10 files, the same field name repeated                                                                                                                                                                |

`createFindingFieldsSchema` is those text fields. `severity` is required and is `findingSeveritySchema`, `z.enum(SEVERITIES)`. `SEVERITIES` lives in `src/config/severity.ts` and is the label list for the `issue_severity` Postgres enum on `issues.severity`. This contract does not define those labels.

A blank optional field is omitted. Omitted `zone` and `locationLabel` are stored as null. Omitted `location` is stored as `{}` (the column default). Omitted `discoveredAt` is stored as the current time. Omitted `reportedBy` is stored as null. When `reportedBy` is set, that user must belong to the organization. Notes are not a field. Description covers that text. A `notes` key is rejected.

The client does not send `code`. `createFindingFieldsSchema` rejects it. The handler does not assign `MAX(code) + 1`. It sets `issues.code` with `nextIssueCodeSql()` in the insert batch (`src/db/issue-code.ts`): `ISS-` plus the sequence integer, padded to at least four digits. The first allocated code is `ISS-1002`. The 201 body returns that text, at most 64 characters. `created_at` and `updated_at` come from the database.

Each photo is checked the way a document file is checked: non-empty, at most 15 MB, extension and media type present and in agreement. An empty photo or a missing media type is `validation_error`. A photo over the cap is `payload_too_large`. An extension or media type that is missing from the list, or that disagrees with the other, is `unsupported_media_type`. More than 10 photos is `too_many_photos`. Zero photos is `validation_error`.

`findingPhotoSchema` is one `issue_media` row, and only columns that table already has: `id`, `issueId`, `storageKey`, `mimeType`, `caption`, `uploadedBy`, `createdAt`, `updatedAt`. `storageKey` is the key `ObjectStorage.put` returns. The client does not choose it. There is no column for the original file name or the byte length, and this contract does not add one. This request has no caption field, so `caption` is null. `uploadedBy` is null until sessions exist (#13).

The handler validates the organization, the asset, the text fields, the photo count, and each photo **before** writing. It then stores each photo through `ObjectStorage.put`. The key requested from the adapter is `{orgId}/issues/{issueId}/{photoId}`. That stays inside the adapter's 500-character key limit and does not collide with a document key `{orgId}/{documentId}`. The row stores the key `put` returns.

The handler then inserts three things in one Neon `db.batch` transaction: the `issues` row, its `issue_media` rows, and one `stage_transitions` row with `from_stage` null and `to_stage` `discovered` (`initialFindingStageTransitionSchema`). A new finding therefore starts at `discovered`, which is the `stage` on the 201 body. neon-http cannot open an interactive transaction, which is the same constraint as document upload. `changed_by` on that transition is null until sessions exist (#13).

If validation fails, nothing is stored. If a later `put` fails, photos already stored for this request are deleted. If the insert fails, every stored photo is deleted.

Local development can use `createLocalDiskStorage()`. Replacing that with another `ObjectStorage` (`put`, `get`, `delete`) does not change this contract. `Content-Length` larger than 10 photos of 15 MB each, plus multipart framing, is `payload_too_large`.

`201` body (`createFindingResultSchema`):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440031",
  "code": "ISS-1002",
  "stage": "discovered",
  "severity": "high",
  "createdAt": "2026-10-12T20:15:00.000Z",
  "photos": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440032",
      "issueId": "550e8400-e29b-41d4-a716-446655440031",
      "storageKey": "550e8400-e29b-41d4-a716-446655440000/issues/550e8400-e29b-41d4-a716-446655440031/550e8400-e29b-41d4-a716-446655440032",
      "mimeType": "image/jpeg",
      "caption": null,
      "uploadedBy": null,
      "createdAt": "2026-10-12T20:15:00.000Z",
      "updatedAt": "2026-10-12T20:15:00.000Z"
    }
  ]
}
```

## Errors

Failures use `apiErrorSchema`:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "description",
        "message": "Too small: expected string to have >=1 characters"
      }
    ]
  }
}
```

`details` is optional. It lists field problems for a validation failure. Other failures omit it.

| HTTP | `error.code`             | When                                                                                                                                                                                                   |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 400  | `invalid_org_id`         | `x-org-id` is missing or not a UUID                                                                                                                                                                    |
| 400  | `unknown_organization`   | `x-org-id` is a UUID and no organization has that id                                                                                                                                                   |
| 400  | `validation_error`       | Not multipart, bad text fields, a missing or unknown severity, an unknown field such as `title`, `notes`, or `groupId`, bad location JSON, no photos, empty photo, missing media type, or unknown user |
| 404  | `asset_not_found`        | `assetId` is not an asset in that organization                                                                                                                                                         |
| 400  | `too_many_photos`        | More than 10 photos                                                                                                                                                                                    |
| 413  | `payload_too_large`      | A photo is over 15 MB, or `Content-Length` cannot fit 10 photos of that size plus multipart framing                                                                                                    |
| 415  | `unsupported_media_type` | Extension or media type is not in the photo list, or they disagree                                                                                                                                     |
| 500  | `internal_error`         | Anything else. `message` is `Something went wrong.` The response does not include the underlying error                                                                                                 |

Status for each finding code is `FINDING_ERROR_HTTP_STATUS` in `src/config/findings.ts`. Findings add `asset_not_found`, `too_many_photos`, and `not_found`. `validation_error`, `payload_too_large`, and `unsupported_media_type` are the codes document routes already use. `internal_error` stays 500.

## Fields the intake form collects that this request does not accept

`createFindingFieldsSchema` rejects these keys. They are not stored.

| Form control | Request key                             | Why it is rejected                                                                                                                              |
| ------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset group  | `groupId`, `assetGroup`, `assetGroupId` | UI filter only. Derive the group from `assets.group_id` on the `assetId` row                                                                    |
| Title        | `title`, `summary`                      | `issues` has no title or summary column. A short title needs a new column such as `issues.summary` and a migration before the API can accept it |
| Notes        | `notes`                                 | Dropped. Description is the write-up. Do not send `notes`                                                                                       |

`issues.code` is allocated by `issue_code_seq` through `nextIssueCodeSql()`. This contract does not allocate it with `MAX(code) + 1`.

## GET /api/findings/{id}/photos/{mediaId}

Streams one photo. The handler does not redirect to a public URL or a signed URL. `x-org-id` is the same temporary organization header as the other finding and document routes.

`id` is the finding (`issues.id`). `mediaId` is `issue_media.id`. Both must be UUIDs. The finding belongs to the organization only through `assets.org_id` on `issues.asset_id`. The media row must use that finding as `issue_id`. One query applies both checks. A missing finding, a finding whose asset is in another organization, and a media id that belongs to a different finding all return the same 404. The body does not say which check failed.

`200` is the object from `ObjectStorage.read`, using the `storage_key` stored on the row. The response headers are:

| Header                   | Value                   |
| ------------------------ | ----------------------- |
| `Content-Type`           | `issue_media.mime_type` |
| `Cache-Control`          | `private`               |
| `X-Content-Type-Options` | `nosniff`               |

If the row matches but the stored object is missing, the response is the same 404.

| HTTP | `error.code`           | When                                                                                                      |
| ---- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| 400  | `invalid_org_id`       | `x-org-id` is missing or not a UUID                                                                       |
| 400  | `unknown_organization` | `x-org-id` is a UUID and no organization has that id                                                      |
| 400  | `validation_error`     | `id` or `mediaId` is not a UUID                                                                           |
| 404  | `not_found`            | The finding is not in the organization, the media is not on that finding, or the stored bytes are missing |
| 500  | `internal_error`       | Anything else. `message` is `Something went wrong.`                                                       |

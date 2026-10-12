# Document API

Upload a reference file and search its chunks. Both routes run on the Node.js runtime, which is the App Router default. This app enables `cacheComponents`, and that setting rejects an explicit `runtime` segment config, so the handlers do not set one. Send the organization on every request:

```http
x-org-id: <organization uuid>
```

Documents belong to that organization. Search never returns another organization's chunks, including when `documentId` is set.

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

The handler embeds the query, orders chunks by pgvector cosine distance (`<=>`), and sets `score` to `1 - distance`. `snippet` is `chunk.text` trimmed to about 300 characters on a word boundary. `documentTitle` comes from the parent document.

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

| HTTP | `error.code`             | When                                                                                                                 |
| ---- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 400  | `validation_error`       | Bad JSON, missing file, missing or invalid `x-org-id`, empty file, unreadable file, unknown organization or uploader |
| 413  | `payload_too_large`      | File or `Content-Length` is over 10 MB                                                                               |
| 415  | `unsupported_media_type` | Extension or media type is not in the upload list, or they disagree                                                  |
| 500  | `internal_error`         | Anything else. `message` is `Something went wrong.` The response does not include the underlying error               |

## Tests

`pnpm test` mocks `embed()` and the database. It does not read `DATABASE_URL` and does not connect to Neon.

The pgvector integration test is skipped unless `SHIPSHAPE_INTEGRATION_DATABASE_URL` is set. That URL must be a normal Postgres connection string, not a `neon.tech` host. CI sets it to the `pgvector/pgvector:pg17` service after `0000_initial` is applied, and runs `src/server/documents/search.integration.test.ts` there. The test still mocks the embedding model and checks cosine order, organization scope, and snippets against the real `vector(384)` column.

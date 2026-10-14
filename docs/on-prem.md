# On-prem Postgres

A customer can run ShipShape against their own Postgres database. We do not host that database. Register its connection string in the control database, then apply the tenant schema there.

## Database

Run PostgreSQL 18 with the [pgvector](https://github.com/pgvector/pgvector) extension. The first tenant migration creates `vector` if the extension is available. Create an empty database for the tenant, for example `shipshape`.

The machine that runs `pnpm tenant:add` needs a network path to that database, and so does the app. Use a direct connection string (no pooler) for migrations. Put `sslmode=require` on any connection that leaves a private network. `sslmode=disable` is only for a database on the same machine or a network you control.

## Register

`CONTROL_DATABASE_URL` is the control database. `TENANT_SECRET_KEY` is the 32-byte AES-256-GCM key, standard base64. Put the customer URL in an environment variable so it does not sit in shell history:

```bash
export TENANT_DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/shipshape?sslmode=require'
pnpm tenant:add --slug acme --name "Acme" --url TENANT_DATABASE_URL
```

`--url -` reads one connection string from stdin instead. `--url` does not accept a `postgres://` or `postgresql://` value; pass an environment variable name or `-`.

The command applies `migrations/control` if needed, encrypts the URL, inserts a `tenants` row, then runs `migrations/` on that database. A slug that is already registered is left unchanged.

## List and later migrations

`pnpm tenant:list` prints `slug`, `name`, `id`, and `created_at`. It does not print connection strings.

`pnpm db:migrate:all` migrates the control database, then every registered tenant. The app looks a tenant up with `getTenantDb(tenantId)` and decrypts the URL with the same `TENANT_SECRET_KEY`.

## Attachment storage

Analysis files can live on the tenant's disk or in S3-compatible storage (including MinIO). Pass `--storage local` or `--storage s3`. The credentials stay in the environment; they are not command arguments. The command encrypts them into `storage_config_encrypted`.

```bash
export STORAGE_LOCAL_DIR=/var/lib/shipshape/files
pnpm tenant:add --slug acme --name "Acme" --url TENANT_DATABASE_URL --storage local
```

```bash
export S3_ENDPOINT='https://s3.example.com'
export S3_REGION=us-east-1
export S3_BUCKET=shipshape
export S3_ACCESS_KEY_ID=...
export S3_SECRET_ACCESS_KEY=...
# S3_FORCE_PATH_STYLE defaults to true, which MinIO needs.
pnpm tenant:add --slug acme --name "Acme" --url TENANT_DATABASE_URL --storage s3
```

Local files are stored under `<STORAGE_LOCAL_DIR>/<tenant id>/`. The default directory is `./storage`. S3 objects use the same key prefix inside the bucket.

When `CONTROL_DATABASE_URL` is unset, the app uses `STORAGE_KIND` (`local` or `s3`, default `local`), `STORAGE_LOCAL_DIR`, and the `S3_*` variables above. `ATTACHMENT_MAX_BYTES` defaults to 25 MiB.

`pnpm tenant:list` does not print storage settings.

## Backup and restore

Install the PostgreSQL 18 client tools (`pg_dump` and `pg_restore`) on the machine that runs these commands. The client major version must not be older than the server. A connection string is passed with `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, and `PGSSLMODE`. It is not a command argument and the commands do not print it.

```bash
pnpm tenant:backup --slug acme
pnpm tenant:backup --slug acme --out backups/acme.dump
pnpm tenant:restore --slug acme --file backups/acme.dump --confirm acme
```

`tenant:backup` writes a custom-format dump (`pg_dump -Fc`) to `./backups/<slug>-<UTC timestamp>.dump` unless `--out` is set. With `CONTROL_DATABASE_URL` set, the URL is the decrypted tenant row. Without it, the command uses `DATABASE_URL`.

When attachment storage is local, the tenant directory is archived next to the dump as a `.tar` file. `tenant:restore` extracts that archive back into the local storage directory when the `.tar` sits beside the dump. S3 attachments are not included. Use bucket versioning for those objects.

`tenant:restore` requires `--confirm` to equal `--slug`. It runs `pg_restore --clean --if-exists --no-owner` into the existing tenant database, then applies `migrations/`.

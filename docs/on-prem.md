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

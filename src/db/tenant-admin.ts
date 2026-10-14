const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const LIST_TENANTS_SQL =
  "select id, slug, name, created_at from tenants order by created_at asc, slug asc";

export const INSERT_TENANT_SQL =
  "insert into tenants (id, slug, name, database_url_encrypted) values (gen_random_uuid(), $1, $2, $3) returning id";

export type ParsedTenantCommand =
  | { command: "list" }
  | { command: "add"; slug: string; name: string; urlFlag: string };

export function parseTenantArgs(argv: readonly string[]): ParsedTenantCommand {
  const [command, ...rest] = argv;
  if (command === "list") {
    if (rest.length > 0) {
      throw new Error("tenant:list takes no arguments.");
    }
    return { command: "list" };
  }
  if (command !== "add") {
    throw new Error("Use tenant:add or tenant:list.");
  }

  const flags = readFlags(rest);
  const slug = flags.slug;
  const name = flags.name?.trim();
  const urlFlag = flags.url;
  if (!slug || !name || urlFlag === undefined || urlFlag.trim() === "") {
    throw new Error("tenant:add requires --slug, --name, and --url.");
  }
  if (!SLUG.test(slug)) {
    throw new Error("Slug must be lowercase letters, numbers, and hyphens.");
  }
  return { command: "add", slug, name, urlFlag: urlFlag.trim() };
}

export function resolveDatabaseUrl(input: {
  urlFlag: string;
  env: Readonly<Record<string, string | undefined>>;
  stdin?: string;
}): string {
  const flag = input.urlFlag.trim();
  if (flag === "-") {
    return requirePostgresUrl((input.stdin ?? "").trim(), "stdin");
  }
  if (isPostgresUrl(flag)) {
    return flag;
  }
  if (ENV_NAME.test(flag)) {
    const value = input.env[flag]?.trim();
    if (!value) {
      throw new Error(`${flag} is not set.`);
    }
    return requirePostgresUrl(value, flag);
  }
  throw new Error(
    "--url must be a postgres URL, an environment variable name, or - to read stdin.",
  );
}

export type RegisterDeps = {
  migrateControl: () => Promise<void>;
  encrypt: (url: string) => string;
  insert: (row: {
    slug: string;
    name: string;
    databaseUrlEncrypted: string;
  }) => Promise<{ id: string } | "exists">;
  migrateTenant: (url: string) => Promise<void>;
};

/**
 * Migrates the control database, stores the encrypted URL, then migrates
 * that tenant database. A duplicate slug does not migrate the tenant.
 */
export async function registerTenant(
  input: { slug: string; name: string; databaseUrl: string },
  deps: RegisterDeps,
): Promise<{ id: string; slug: string; name: string }> {
  await deps.migrateControl();
  const databaseUrlEncrypted = deps.encrypt(input.databaseUrl);
  const inserted = await deps.insert({
    slug: input.slug,
    name: input.name,
    databaseUrlEncrypted,
  });
  if (inserted === "exists") {
    throw new Error(`Tenant ${input.slug} is already registered.`);
  }
  await deps.migrateTenant(input.databaseUrl);
  return { id: inserted.id, slug: input.slug, name: input.name };
}

export function formatRegistered(row: { id: string; slug: string }): string {
  return `Registered ${row.slug} (${row.id}).`;
}

export type TenantListRow = {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
};

export function formatTenantList(rows: readonly TenantListRow[]): string {
  const lines = ["slug\tname\tid\tcreated_at"];
  for (const row of rows) {
    lines.push([row.slug, row.name, row.id, row.createdAt].join("\t"));
  }
  return lines.join("\n");
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function readFlags(args: readonly string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === undefined || !token.startsWith("--")) {
      throw new Error("Unexpected argument.");
    }
    const body = token.slice(2);
    const equals = body.indexOf("=");
    if (equals >= 0) {
      flags[body.slice(0, equals)] = body.slice(equals + 1);
      continue;
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${body}.`);
    }
    flags[body] = value;
    index += 1;
  }
  return flags;
}

function isPostgresUrl(value: string): boolean {
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}

function requirePostgresUrl(value: string, source: string): string {
  if (!isPostgresUrl(value)) {
    throw new Error(`${source} must be a postgres connection string.`);
  }
  return value;
}

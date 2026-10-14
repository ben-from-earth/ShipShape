import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";

import pg from "pg";

import {
  storageConfigFromEnv,
  storageConfigFromPayload,
  storageKindFromEnv,
} from "../storage/config";
import { migrateDatabase, tenantMigrationsFolder } from "./migrate-all";
import { decryptDatabaseUrl } from "./tenant-secret";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const POSTGRES_URL = /postgres(ql)?:\/\//i;
const REQUIRED_CLIENT_MAJOR = 18;
const MAX_OUTPUT = 8_000;

const LOOKUP_SQL =
  "select id, database_url_encrypted, storage_kind, storage_config_encrypted from tenants where slug = $1";

const LIBPQ_ENV: Record<string, string> = {
  host: "PGHOST",
  port: "PGPORT",
  user: "PGUSER",
  password: "PGPASSWORD",
  dbname: "PGDATABASE",
  sslmode: "PGSSLMODE",
  sslrootcert: "PGSSLROOTCERT",
  sslcert: "PGSSLCERT",
  sslkey: "PGSSLKEY",
  sslpassword: "PGSSLPASSWORD",
  connect_timeout: "PGCONNECT_TIMEOUT",
  application_name: "PGAPPNAME",
  options: "PGOPTIONS",
  requiressl: "PGREQUIRESSL",
  gssencmode: "PGGSSENCMODE",
  channel_binding: "PGCHANNELBINDING",
  target_session_attrs: "PGTARGETSESSIONATTRS",
};

export type BackupStorage = { kind: "local"; rootDir: string } | { kind: "s3" };

export type BackupTarget = {
  databaseUrl: string;
  tenantId: string | null;
  storage: BackupStorage;
};

export type ParsedBackup =
  | { command: "backup"; slug: string; out?: string }
  | { command: "restore"; slug: string; file: string; confirm: string };

type SpawnResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

export type BackupDeps = {
  serverVersion: (databaseUrl: string) => Promise<number>;
  resolveTenant: (slug: string) => Promise<BackupTarget>;
  migrateTenant: (databaseUrl: string) => Promise<void>;
  now: () => Date;
  exists: (filePath: string) => Promise<boolean>;
  mkdir: (dir: string) => Promise<void>;
  env: Readonly<Record<string, string | undefined>>;
  cwd: string;
};

export function parseTenantBackupArgs(argv: readonly string[]): ParsedBackup {
  const [command, ...rest] = argv;
  if (command !== "backup" && command !== "restore") {
    throw new Error("Use tenant:backup or tenant:restore.");
  }
  const flags = readFlags(rest);
  const slug = flags.slug?.trim() ?? "";
  if (command === "backup") {
    rejectUnknown(flags, ["slug", "out"]);
    if (!slug) {
      throw new Error("tenant:backup requires --slug.");
    }
    assertSlug(slug);
    const out = flags.out?.trim();
    if (flags.out !== undefined && !out) {
      throw new Error("--out needs a file.");
    }
    return out ? { command: "backup", slug, out } : { command: "backup", slug };
  }

  rejectUnknown(flags, ["slug", "file", "confirm"]);
  const file = flags.file?.trim() ?? "";
  const confirm = flags.confirm?.trim() ?? "";
  if (!slug || !file || !confirm) {
    throw new Error("tenant:restore requires --slug, --file, and --confirm.");
  }
  assertSlug(slug);
  if (confirm !== slug) {
    throw new Error("--confirm must match --slug.");
  }
  return { command: "restore", slug, file, confirm };
}

/** Libpq environment for a postgres URL. The URL itself is not returned. */
export function libpqEnv(connectionString: string): Record<string, string> {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Tenant database URL is invalid.");
  }
  const protocol = url.protocol.toLowerCase();
  if (protocol !== "postgresql:" && protocol !== "postgres:") {
    throw new Error("Tenant database URL is invalid.");
  }

  const env: Record<string, string> = {};
  if (url.hostname) {
    env.PGHOST = decode(url.hostname);
  }
  env.PGPORT = url.port || "5432";
  if (url.username) {
    env.PGUSER = decode(url.username);
  }
  if (url.password) {
    env.PGPASSWORD = decode(url.password);
  }
  const database = decode(url.pathname.replace(/^\//, ""));
  if (database) {
    env.PGDATABASE = database;
  }
  for (const [key, value] of url.searchParams) {
    const name = LIBPQ_ENV[key];
    if (name) {
      env[name] = value;
    }
  }
  if (!env.PGDATABASE) {
    throw new Error("Tenant database URL has no database name.");
  }
  return env;
}

export function pgDumpArgs(outFile: string): string[] {
  return ["-Fc", "-f", outFile];
}

export function pgRestoreArgs(database: string, file: string): string[] {
  return ["--clean", "--if-exists", "--no-owner", "--dbname", database, file];
}

export function backupStamp(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");
  const second = String(now.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}${minute}${second}Z`;
}

export function defaultDumpPath(cwd: string, slug: string, now: Date): string {
  return path.join(cwd, "backups", `${slug}-${backupStamp(now)}.dump`);
}

export function attachmentArchivePath(dumpPath: string): string {
  return dumpPath.endsWith(".dump")
    ? `${dumpPath.slice(0, -".dump".length)}.tar`
    : `${dumpPath}.tar`;
}

/**
 * pg_dump / pg_restore must be the PostgreSQL 18 client, and not older than
 * the server major version.
 */
export function assertClientMajor(
  tool: string,
  versionText: string,
  serverVersionNum: number,
): void {
  const match = versionText.match(/\(PostgreSQL\)\s+(\d+)/);
  const major = match?.[1];
  if (major === undefined) {
    throw new Error(
      `Could not read the ${tool} version. Install the PostgreSQL 18 client tools.`,
    );
  }
  const clientMajor = Number(major);
  const serverMajor = Math.floor(serverVersionNum / 10_000);
  if (clientMajor < serverMajor) {
    throw new Error(
      `${tool} ${clientMajor} is older than the Postgres server (${serverMajor}). Install the PostgreSQL 18 client tools.`,
    );
  }
  if (clientMajor < REQUIRED_CLIENT_MAJOR) {
    throw new Error(
      `${tool} ${clientMajor} is not the PostgreSQL 18 client. Install the PostgreSQL 18 client tools.`,
    );
  }
}

export function redactSecrets(
  text: string,
  secrets: readonly string[],
): string {
  const hidden = [...secrets]
    .filter((secret) => secret.length > 0)
    .sort((left, right) => right.length - left.length);
  let result = text;
  for (const secret of hidden) {
    result = result.split(secret).join("[redacted]");
  }
  return result;
}

export async function backupTenant(
  input: { slug: string; out?: string },
  deps: BackupDeps,
): Promise<string> {
  const target = await deps.resolveTenant(input.slug);
  const dumpPath =
    input.out ?? defaultDumpPath(deps.cwd, input.slug, deps.now());
  const pgEnv = libpqEnv(target.databaseUrl);
  const secrets = secretValues(target.databaseUrl, pgEnv);
  await deps.mkdir(path.dirname(dumpPath));
  await assertTool("pg_dump", target.databaseUrl, secrets, deps);
  await runChecked(
    "pg_dump",
    pgDumpArgs(dumpPath),
    commandEnv(deps.env, pgEnv, secrets),
    secrets,
  );
  const files = await archiveLocalAttachments(
    target,
    attachmentArchivePath(dumpPath),
    secrets,
    deps,
  );
  return formatBackup(
    input.slug,
    dumpPath,
    files,
    attachmentArchivePath(dumpPath),
  );
}

export async function restoreTenant(
  input: { slug: string; file: string; confirm: string },
  deps: BackupDeps,
): Promise<string> {
  if (input.confirm !== input.slug) {
    throw new Error("--confirm must match --slug.");
  }
  if (!(await deps.exists(input.file))) {
    throw new Error("Backup file was not found.");
  }
  const target = await deps.resolveTenant(input.slug);
  const pgEnv = libpqEnv(target.databaseUrl);
  const secrets = secretValues(target.databaseUrl, pgEnv);
  const database = pgEnv.PGDATABASE;
  if (!database) {
    throw new Error("Tenant database URL has no database name.");
  }
  await assertTool("pg_restore", target.databaseUrl, secrets, deps);
  await runChecked(
    "pg_restore",
    pgRestoreArgs(database, input.file),
    commandEnv(deps.env, pgEnv, secrets),
    secrets,
  );
  try {
    await deps.migrateTenant(target.databaseUrl);
  } catch (error) {
    throw redactError(error, secrets);
  }
  const archive = attachmentArchivePath(input.file);
  const restoredFiles = await restoreLocalAttachments(
    target,
    archive,
    secrets,
    deps,
  );
  return formatRestore(input.slug, input.file, restoredFiles, archive);
}

export async function resolveBackupTarget(
  slug: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<BackupTarget> {
  const controlUrl = env.CONTROL_DATABASE_URL?.trim();
  if (!controlUrl) {
    return fallbackTarget(env);
  }

  const secrets = [controlUrl];
  const pool = new pg.Pool({ connectionString: controlUrl });
  try {
    const result = await pool.query<{
      id: string;
      database_url_encrypted: string;
      storage_kind: string;
      storage_config_encrypted: string | null;
    }>(LOOKUP_SQL, [slug]);
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Tenant ${slug} was not found.`);
    }
    const databaseUrl = decryptDatabaseUrl(row.database_url_encrypted);
    secrets.push(databaseUrl);
    return {
      databaseUrl,
      tenantId: row.id,
      storage: storageForRow(row, env),
    };
  } catch (error) {
    throw redactError(error, secrets);
  } finally {
    await pool.end();
  }
}

export async function runBackupCommand(
  argv: readonly string[],
): Promise<string> {
  const parsed = parseTenantBackupArgs(argv);
  const deps = defaultDeps();
  if (parsed.command === "backup") {
    return backupTenant(parsed, deps);
  }
  return restoreTenant(parsed, deps);
}

function fallbackTarget(
  env: Readonly<Record<string, string | undefined>>,
): BackupTarget {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Set it, or set CONTROL_DATABASE_URL to back up a registered tenant.",
    );
  }
  const kind = storageKindFromEnv(env);
  if (kind === "s3") {
    return { databaseUrl, tenantId: null, storage: { kind: "s3" } };
  }
  const storage = storageConfigFromEnv("local", env);
  return { databaseUrl, tenantId: null, storage };
}

function storageForRow(
  row: {
    storage_kind: string;
    storage_config_encrypted: string | null;
  },
  env: Readonly<Record<string, string | undefined>>,
): BackupStorage {
  if (row.storage_kind === "s3") {
    return { kind: "s3" };
  }
  if (row.storage_kind !== "local") {
    throw new Error("Tenant storage kind is invalid.");
  }
  if (!row.storage_config_encrypted) {
    const storage = storageConfigFromEnv("local", env);
    return storage;
  }
  const storage = storageConfigFromPayload(
    "local",
    decryptDatabaseUrl(row.storage_config_encrypted),
  );
  return storage;
}

async function assertTool(
  tool: "pg_dump" | "pg_restore",
  databaseUrl: string,
  secrets: readonly string[],
  deps: BackupDeps,
): Promise<void> {
  const version = await runChecked(
    tool,
    ["--version"],
    commandEnv(deps.env, {}, secrets),
    secrets,
  );
  let serverVersion: number;
  try {
    serverVersion = await deps.serverVersion(databaseUrl);
  } catch (error) {
    throw redactError(error, secrets);
  }
  assertClientMajor(
    tool,
    `${version.stdout}\n${version.stderr}`,
    serverVersion,
  );
}

async function archiveLocalAttachments(
  target: BackupTarget,
  archivePath: string,
  secrets: readonly string[],
  deps: BackupDeps,
): Promise<"archived" | "empty" | "s3"> {
  if (target.storage.kind !== "local") {
    return "s3";
  }
  const rootDir = target.storage.rootDir;
  if (target.tenantId) {
    const tenantDir = path.join(rootDir, target.tenantId);
    if (!(await deps.exists(tenantDir))) {
      return "empty";
    }
    await runChecked(
      "tar",
      ["-cf", archivePath, "-C", rootDir, target.tenantId],
      commandEnv(deps.env, {}, secrets),
      secrets,
    );
    return "archived";
  }
  if (!(await deps.exists(rootDir))) {
    return "empty";
  }
  await runChecked(
    "tar",
    ["-cf", archivePath, "-C", path.dirname(rootDir), path.basename(rootDir)],
    commandEnv(deps.env, {}, secrets),
    secrets,
  );
  return "archived";
}

async function restoreLocalAttachments(
  target: BackupTarget,
  archivePath: string,
  secrets: readonly string[],
  deps: BackupDeps,
): Promise<"restored" | "missing" | "s3"> {
  if (target.storage.kind !== "local") {
    return "s3";
  }
  if (!(await deps.exists(archivePath))) {
    return "missing";
  }
  await deps.mkdir(target.storage.rootDir);
  await runChecked(
    "tar",
    ["-xf", archivePath, "-C", target.storage.rootDir],
    commandEnv(deps.env, {}, secrets),
    secrets,
  );
  return "restored";
}

function formatBackup(
  slug: string,
  dumpPath: string,
  files: "archived" | "empty" | "s3",
  archivePath: string,
): string {
  const lines = [`Backed up ${slug} to ${dumpPath}.`];
  if (files === "archived") {
    lines.push(`Backed up local attachments to ${archivePath}.`);
  } else if (files === "empty") {
    lines.push("No local attachment files were found.");
  } else {
    lines.push("S3 attachments are not included. Use bucket versioning.");
  }
  return lines.join("\n");
}

function formatRestore(
  slug: string,
  file: string,
  files: "restored" | "missing" | "s3",
  archivePath: string,
): string {
  const lines = [`Restored ${slug} from ${file}.`];
  if (files === "restored") {
    lines.push(`Restored local attachments from ${archivePath}.`);
  } else if (files === "missing") {
    lines.push("No local attachment archive was found.");
  }
  return lines.join("\n");
}

export function commandEnv(
  parent: Readonly<Record<string, string | undefined>>,
  pgEnv: Record<string, string>,
  secrets: readonly string[],
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(parent)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  Object.assign(env, pgEnv);
  delete env.DATABASE_URL;
  delete env.CONTROL_DATABASE_URL;
  delete env.TENANT_SECRET_KEY;
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("PG")) {
      continue;
    }
    if (
      typeof value === "string" &&
      secrets.some((secret) => secret.length > 0 && value.includes(secret))
    ) {
      delete env[key];
    }
  }
  return env;
}

function secretValues(
  databaseUrl: string,
  pgEnv: Record<string, string>,
): string[] {
  const secrets = [databaseUrl];
  if (pgEnv.PGPASSWORD) {
    secrets.push(pgEnv.PGPASSWORD);
  }
  const userinfo = databaseUrl.split("://")[1]?.split("@")[0];
  if (userinfo?.includes(":")) {
    secrets.push(userinfo);
  }
  return secrets;
}

async function runChecked(
  command: "pg_dump" | "pg_restore" | "tar",
  args: readonly string[],
  env: Record<string, string>,
  secrets: readonly string[],
): Promise<SpawnResult> {
  assertArgvSafe(args);
  let result: SpawnResult;
  try {
    result = await spawnCommand(command, args, env);
  } catch (error) {
    if (isEnoent(error)) {
      throw new Error(
        command === "tar"
          ? "tar was not found."
          : `${command} was not found. Install the PostgreSQL 18 client tools.`,
      );
    }
    throw redactError(error, secrets);
  }
  if (result.code !== 0) {
    const detail = redactSecrets(result.stderr.trim(), secrets);
    throw new Error(
      detail ? `${command} failed: ${detail}` : `${command} failed.`,
    );
  }
  return result;
}

function assertArgvSafe(args: readonly string[]): void {
  for (const arg of args) {
    if (POSTGRES_URL.test(arg)) {
      throw new Error("Refusing to pass a database URL on the command line.");
    }
  }
}

function spawnCommand(
  command: string,
  args: readonly string[],
  env: Record<string, string>,
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      env: env as NodeJS.ProcessEnv,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout.push(Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr.push(Buffer.from(chunk));
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });
    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        code,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8").slice(0, MAX_OUTPUT),
        stderr: Buffer.concat(stderr).toString("utf8").slice(0, MAX_OUTPUT),
      });
    });
  });
}

function defaultDeps(): BackupDeps {
  return {
    serverVersion: serverVersionNum,
    resolveTenant: (slug) => resolveBackupTarget(slug),
    migrateTenant: (url) => migrateDatabase(url, tenantMigrationsFolder),
    now: () => new Date(),
    exists: pathExists,
    mkdir: (dir) => mkdir(dir, { recursive: true }).then(() => undefined),
    env: process.env,
    cwd: process.cwd(),
  };
}

async function serverVersionNum(databaseUrl: string): Promise<number> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query<{ server_version_num: string }>(
      "select current_setting('server_version_num') as server_version_num",
    );
    const value = Number(result.rows[0]?.server_version_num);
    if (!Number.isInteger(value)) {
      throw new Error("Could not read the Postgres server version.");
    }
    return value;
  } finally {
    await pool.end();
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function redactError(error: unknown, secrets: readonly string[]): Error {
  const message = error instanceof Error ? error.message : "Command failed.";
  return new Error(redactSecrets(message, secrets));
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function assertSlug(slug: string): void {
  if (!SLUG.test(slug)) {
    throw new Error("Slug must be lowercase letters, numbers, and hyphens.");
  }
}

function rejectUnknown(
  flags: Readonly<Record<string, string>>,
  allowed: readonly string[],
): void {
  const names = new Set(allowed);
  for (const name of Object.keys(flags)) {
    if (!names.has(name)) {
      throw new Error("Unexpected argument.");
    }
  }
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

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("Tenant database URL is invalid.");
  }
}

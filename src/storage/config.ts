import { z } from "zod";

const localConfigSchema = z.strictObject({
  rootDir: z.string().trim().min(1),
});

const s3ConfigSchema = z.strictObject({
  endpoint: z.string().trim().min(1),
  region: z.string().trim().min(1),
  bucket: z.string().trim().min(1),
  accessKeyId: z.string().trim().min(1),
  secretAccessKey: z.string().min(1),
  forcePathStyle: z.boolean(),
});

export type LocalStorageConfig = { kind: "local"; rootDir: string };
export type S3StorageConfig = { kind: "s3" } & z.infer<typeof s3ConfigSchema>;
export type StorageConfig = LocalStorageConfig | S3StorageConfig;

const S3_ENV = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

/** Config for `tenant:add --storage` and for fallback mode. Secrets stay in env. */
export function storageConfigFromEnv(
  kind: "local" | "s3",
  env: Readonly<Record<string, string | undefined>>,
): StorageConfig {
  if (kind === "local") {
    const rootDir = env.STORAGE_LOCAL_DIR?.trim() || "./storage";
    return { kind: "local", rootDir };
  }

  const values: Record<(typeof S3_ENV)[number], string> = {
    S3_ENDPOINT: "",
    S3_REGION: "",
    S3_BUCKET: "",
    S3_ACCESS_KEY_ID: "",
    S3_SECRET_ACCESS_KEY: "",
  };
  for (const name of S3_ENV) {
    const value = env[name]?.trim();
    if (!value) {
      throw new Error(`${name} is not set.`);
    }
    values[name] = value;
  }
  return {
    kind: "s3",
    endpoint: values.S3_ENDPOINT,
    region: values.S3_REGION,
    bucket: values.S3_BUCKET,
    accessKeyId: values.S3_ACCESS_KEY_ID,
    secretAccessKey: values.S3_SECRET_ACCESS_KEY,
    forcePathStyle: parseForcePathStyle(env.S3_FORCE_PATH_STYLE),
  };
}

export function storageKindFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): "local" | "s3" {
  const kind = env.STORAGE_KIND?.trim() || "local";
  if (kind !== "local" && kind !== "s3") {
    throw new Error("STORAGE_KIND must be local or s3.");
  }
  return kind;
}

/** JSON stored in `storage_config_encrypted`. Kind stays on its own column. */
export function storageConfigPayload(config: StorageConfig): string {
  if (config.kind === "local") {
    return JSON.stringify({ rootDir: config.rootDir });
  }
  return JSON.stringify({
    endpoint: config.endpoint,
    region: config.region,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    forcePathStyle: config.forcePathStyle,
  });
}

export function storageConfigFromPayload(
  kind: "local" | "s3",
  payload: string,
): StorageConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("Tenant storage config is invalid.");
  }
  if (kind === "local") {
    const result = localConfigSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("Tenant storage config is invalid.");
    }
    return { kind: "local", rootDir: result.data.rootDir };
  }
  const result = s3ConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Tenant storage config is invalid.");
  }
  return { kind: "s3", ...result.data };
}

function parseForcePathStyle(value: string | undefined): boolean {
  const flag = value?.trim().toLowerCase();
  if (flag === undefined || flag === "") {
    return true;
  }
  if (flag === "true" || flag === "1") {
    return true;
  }
  if (flag === "false" || flag === "0") {
    return false;
  }
  throw new Error("S3_FORCE_PATH_STYLE must be true or false.");
}

import { randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import "server-only";

import { tenants } from "@/db/control-schema";
import { decryptDatabaseUrl } from "@/db/tenant-secret";

import {
  storageConfigFromEnv,
  storageConfigFromPayload,
  storageKindFromEnv,
  type StorageConfig,
} from "./config";
import type { StorageDriver, StoredObject } from "./driver";
import { sanitizeFileName } from "./key";
import { LocalDiskDriver } from "./local";
import { createS3Client, S3Driver } from "./s3";

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

export type AttachmentBody = Buffer | ReadableStream<Uint8Array>;

export type PutAttachmentInput = {
  fileName: string;
  contentType: string;
  body: AttachmentBody;
  size: number;
};

const drivers = new Map<string, StorageDriver>();
let control: ReturnType<typeof openControl> | undefined;

export function maxAttachmentBytes(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env.ATTACHMENT_MAX_BYTES?.trim();
  if (!raw) {
    return DEFAULT_MAX_BYTES;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("ATTACHMENT_MAX_BYTES is invalid.");
  }
  return value;
}

export async function putAttachment(
  tenantId: string,
  input: PutAttachmentInput,
): Promise<{ storageKey: string; size: number; contentType: string }> {
  const max = maxAttachmentBytes();
  if (!Number.isInteger(input.size) || input.size < 0) {
    throw new Error("Attachment size is invalid.");
  }
  if (input.size > max) {
    throw new Error(`Attachment is larger than ${max} bytes.`);
  }
  const body = await readBody(input.body, input.size, max);
  const storageKey = `attachments/${randomUUID()}/${sanitizeFileName(input.fileName)}`;
  const driver = await getTenantStorage(tenantId);
  await driver.put(storageKey, body, input.contentType);
  return { storageKey, size: body.length, contentType: input.contentType };
}

export async function getAttachmentFile(
  tenantId: string,
  storageKey: string,
): Promise<StoredObject> {
  const driver = await getTenantStorage(tenantId);
  return driver.get(storageKey);
}

export async function deleteAttachmentFile(
  tenantId: string,
  storageKey: string,
): Promise<void> {
  const driver = await getTenantStorage(tenantId);
  await driver.delete(storageKey);
}

/** Cached driver for one tenant. Without a control database, uses env. */
export async function getTenantStorage(
  tenantId: string,
): Promise<StorageDriver> {
  const existing = drivers.get(tenantId);
  if (existing) {
    return existing;
  }
  const config = await loadStorageConfig(tenantId);
  const driver = openDriver(tenantId, config);
  drivers.set(tenantId, driver);
  return driver;
}

function openDriver(tenantId: string, config: StorageConfig): StorageDriver {
  if (config.kind === "local") {
    return new LocalDiskDriver(config.rootDir, tenantId);
  }
  return new S3Driver(createS3Client(config), config.bucket, tenantId);
}

async function loadStorageConfig(tenantId: string): Promise<StorageConfig> {
  if (!process.env.CONTROL_DATABASE_URL) {
    return storageConfigFromEnv(storageKindFromEnv(process.env), process.env);
  }
  const rows = await controlDb()
    .select({
      storageKind: tenants.storageKind,
      storageConfigEncrypted: tenants.storageConfigEncrypted,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new Error(`Tenant ${tenantId} was not found.`);
  }
  if (!row.storageConfigEncrypted) {
    if (row.storageKind === "local") {
      return storageConfigFromEnv("local", process.env);
    }
    throw new Error("Tenant storage config is missing.");
  }
  return storageConfigFromPayload(
    row.storageKind,
    decryptDatabaseUrl(row.storageConfigEncrypted),
  );
}

function openControl() {
  const url = process.env.CONTROL_DATABASE_URL;
  if (!url) {
    throw new Error("CONTROL_DATABASE_URL is not set.");
  }
  return drizzle({ client: neon(url), schema: { tenants } });
}

function controlDb() {
  control ??= openControl();
  return control;
}

async function readBody(
  body: AttachmentBody,
  size: number,
  max: number,
): Promise<Buffer> {
  if (Buffer.isBuffer(body)) {
    if (body.length !== size) {
      throw new Error("Attachment size does not match the body.");
    }
    return body;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      total += next.value.byteLength;
      if (total > max) {
        throw new Error(`Attachment is larger than ${max} bytes.`);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total !== size) {
    throw new Error("Attachment size does not match the body.");
  }
  return Buffer.concat(chunks);
}

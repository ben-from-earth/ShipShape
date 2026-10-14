import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StorageDriver, StoredObject } from "./driver";
import { assertSafeStorageKey } from "./key";

/**
 * Files live at `rootDir/<tenantId>/<key>`.
 * Content type is a sibling `.meta.json` file.
 */
export class LocalDiskDriver implements StorageDriver {
  private readonly tenantRoot: string;

  constructor(
    rootDir: string,
    private readonly tenantId: string,
  ) {
    if (!/^[A-Za-z0-9-]+$/.test(tenantId)) {
      throw new Error("Tenant id is invalid.");
    }
    this.tenantRoot = path.resolve(rootDir, tenantId);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    await writeFile(metaPath(file), JSON.stringify({ contentType }), "utf8");
  }

  async get(key: string): Promise<StoredObject> {
    const file = this.resolve(key);
    const [body, meta] = await Promise.all([
      readFile(file),
      readFile(metaPath(file), "utf8"),
    ]);
    const parsed = JSON.parse(meta) as { contentType?: unknown };
    const contentType =
      typeof parsed.contentType === "string"
        ? parsed.contentType
        : "application/octet-stream";
    return { body, contentType, size: body.length };
  }

  async delete(key: string): Promise<void> {
    const file = this.resolve(key);
    await rm(file, { force: true });
    await rm(metaPath(file), { force: true });
  }

  private resolve(key: string): string {
    const safe = assertSafeStorageKey(key);
    const full = path.resolve(this.tenantRoot, safe);
    const relative = path.relative(this.tenantRoot, full);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Storage key is invalid.");
    }
    return full;
  }
}

function metaPath(file: string): string {
  return `${file}.meta.json`;
}

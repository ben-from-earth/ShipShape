import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredObject = {
  key: string;
};

/**
 * Bytes addressed by a key. Document routes depend on this, not on a
 * vendor SDK. A later object store can implement the same three methods.
 * `put` returns the key that was stored; the document row saves that key.
 */
export interface ObjectStorage {
  put(key: string, body: Uint8Array): Promise<StoredObject>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

/** Default root for the local adapter. Override with DOCUMENT_STORAGE_DIR. */
export function documentStorageRoot(): string {
  const configured = process.env.DOCUMENT_STORAGE_DIR?.trim();
  if (configured) {
    return configured;
  }
  return path.join(process.cwd(), ".data", "documents");
}

/**
 * Writes files under `root`. Keys are relative paths. `..`, absolute paths,
 * and NUL bytes are rejected so a key cannot escape the root.
 */
export function createLocalDiskStorage(
  root: string = documentStorageRoot(),
): ObjectStorage {
  const directory = path.resolve(/*turbopackIgnore: true*/ root);

  return {
    async put(key, body) {
      const file = resolveKey(directory, key);
      await mkdir(/*turbopackIgnore: true*/ path.dirname(file), {
        recursive: true,
      });
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        await writeFile(/*turbopackIgnore: true*/ temporary, body);
        await rename(
          /*turbopackIgnore: true*/ temporary,
          /*turbopackIgnore: true*/ file,
        );
      } catch (error) {
        await rm(/*turbopackIgnore: true*/ temporary, { force: true });
        throw error;
      }
      return { key };
    },

    async get(key) {
      try {
        return new Uint8Array(
          await readFile(/*turbopackIgnore: true*/ resolveKey(directory, key)),
        );
      } catch (error) {
        if (isNotFound(error)) {
          return null;
        }
        throw error;
      }
    },

    async delete(key) {
      await rm(/*turbopackIgnore: true*/ resolveKey(directory, key), {
        force: true,
      });
    },
  };
}

function resolveKey(root: string, key: string): string {
  if (
    key.length === 0 ||
    key.length > 500 ||
    key.includes("\0") ||
    key.includes("..") ||
    path.isAbsolute(key)
  ) {
    throw new Error("Invalid storage key");
  }

  const resolved = path.resolve(/*turbopackIgnore: true*/ root, key);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid storage key");
  }

  return resolved;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

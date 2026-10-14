/** Rejects absolute paths, empty segments, and `..`. */
export function assertSafeStorageKey(key: string): string {
  if (key.includes("\0") || key.includes("\\")) {
    throw new Error("Storage key is invalid.");
  }
  const parts = key.split("/");
  if (
    parts.length === 0 ||
    parts.some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    throw new Error("Storage key is invalid.");
  }
  return parts.join("/");
}

/** Last path segment, limited to letters, numbers, dot, underscore, and hyphen. */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.replaceAll("\\", "/").split("/").pop() ?? "";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "");
  const trimmed = cleaned.slice(0, 200);
  return trimmed.length === 0 ? "file" : trimmed;
}

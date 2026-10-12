import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLocalDiskStorage } from "@/server/storage";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function storage() {
  const root = await mkdtemp(path.join(tmpdir(), "shipshape-storage-"));
  roots.push(root);
  return createLocalDiskStorage(root);
}

describe("local disk storage", () => {
  it("round-trips bytes and treats a missing key as empty", async () => {
    const disk = await storage();
    const body = new TextEncoder().encode("hull plate");

    await expect(disk.put("org/doc", body)).resolves.toEqual({
      key: "org/doc",
    });
    await expect(disk.get("org/doc")).resolves.toEqual(body);
    await disk.delete("org/doc");
    await expect(disk.get("org/doc")).resolves.toBeNull();
    await disk.delete("org/doc");
  });

  it("rejects keys that leave the storage root", async () => {
    const disk = await storage();
    const body = new Uint8Array([1]);

    await expect(disk.get("../secrets")).rejects.toThrow(
      /invalid storage key/i,
    );
    await expect(disk.put("/etc/passwd", body)).rejects.toThrow(
      /invalid storage key/i,
    );
    await expect(disk.delete("org/../../outside")).rejects.toThrow(
      /invalid storage key/i,
    );
  });
});

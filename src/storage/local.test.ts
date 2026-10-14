import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  deleteAttachmentFile,
  getAttachmentFile,
  putAttachment,
} from "./attachments";
import { LocalDiskDriver } from "./local";

const tenantId = "71000000-0000-4000-8000-0000000000aa";
const previous = {
  control: process.env.CONTROL_DATABASE_URL,
  kind: process.env.STORAGE_KIND,
  dir: process.env.STORAGE_LOCAL_DIR,
};

afterEach(() => {
  restore("CONTROL_DATABASE_URL", previous.control);
  restore("STORAGE_KIND", previous.kind);
  restore("STORAGE_LOCAL_DIR", previous.dir);
});

describe("local attachment storage", () => {
  it("round-trips a file under the tenant directory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "shipshape-local-"));
    const driver = new LocalDiskDriver(root, tenantId);
    const key = "attachments/11111111-1111-4111-8111-111111111111/notes.txt";
    await driver.put(key, Buffer.from("hello"), "text/plain");

    const stored = await driver.get(key);
    expect(stored.body.toString("utf8")).toBe("hello");
    expect(stored.contentType).toBe("text/plain");
    expect(stored.size).toBe(5);
    expect(await readFile(path.join(root, tenantId, key), "utf8")).toBe(
      "hello",
    );

    await driver.delete(key);
    await expect(driver.get(key)).rejects.toThrow();
  });

  it("rejects a key that escapes the tenant directory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "shipshape-escape-"));
    await writeFile(path.join(root, "outside.txt"), "secret");
    const driver = new LocalDiskDriver(root, tenantId);

    await expect(
      driver.put("../outside.txt", Buffer.from("x"), "text/plain"),
    ).rejects.toThrow(/invalid/);
    await expect(driver.get("attachments/../../outside.txt")).rejects.toThrow(
      /invalid/,
    );
    expect(await readFile(path.join(root, "outside.txt"), "utf8")).toBe(
      "secret",
    );
  });

  it("stores an upload and reads it back", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "shipshape-put-"));
    delete process.env.CONTROL_DATABASE_URL;
    process.env.STORAGE_KIND = "local";
    process.env.STORAGE_LOCAL_DIR = root;

    const saved = await putAttachment(tenantId, {
      fileName: "../../notes.txt",
      contentType: "text/plain",
      body: Buffer.from("wing"),
      size: 4,
    });
    expect(saved.storageKey).toMatch(
      /^attachments\/[0-9a-f-]{36}\/notes\.txt$/,
    );
    expect(saved).toMatchObject({ size: 4, contentType: "text/plain" });

    const loaded = await getAttachmentFile(tenantId, saved.storageKey);
    expect(loaded.body.toString("utf8")).toBe("wing");
    await deleteAttachmentFile(tenantId, saved.storageKey);
    await expect(
      getAttachmentFile(tenantId, saved.storageKey),
    ).rejects.toThrow();
  });
});

function restore(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";

import { S3Driver, type ObjectStorageClient } from "./s3";

describe("S3 attachment storage", () => {
  it("puts, gets, and deletes through the client with a tenant prefix", async () => {
    const objects = new Map<string, { body: Buffer; contentType: string }>();
    const client: ObjectStorageClient = {
      async send(command: unknown) {
        if (command instanceof PutObjectCommand) {
          const body = command.input.Body;
          objects.set(command.input.Key ?? "", {
            body: Buffer.isBuffer(body)
              ? body
              : Buffer.from(body as Uint8Array),
            contentType: command.input.ContentType ?? "",
          });
          return {};
        }
        if (command instanceof GetObjectCommand) {
          const found = objects.get(command.input.Key ?? "");
          return {
            ContentType: found?.contentType,
            Body: found
              ? {
                  transformToByteArray: async () => new Uint8Array(found.body),
                }
              : undefined,
          };
        }
        if (command instanceof DeleteObjectCommand) {
          objects.delete(command.input.Key ?? "");
          return {};
        }
        throw new Error("Unexpected command.");
      },
    };
    const driver = new S3Driver(client, "bucket", "tenant-1");
    await driver.put(
      "attachments/id/calc.pdf",
      Buffer.from("pdf"),
      "application/pdf",
    );

    expect(objects.has("tenant-1/attachments/id/calc.pdf")).toBe(true);
    const stored = await driver.get("attachments/id/calc.pdf");
    expect(stored.body.toString("utf8")).toBe("pdf");
    expect(stored.contentType).toBe("application/pdf");
    expect(stored.size).toBe(3);

    await driver.delete("attachments/id/calc.pdf");
    expect(objects.size).toBe(0);
  });

  it("does not send a key that escapes the tenant prefix", async () => {
    let sent = 0;
    const client: ObjectStorageClient = {
      async send() {
        sent += 1;
        return {};
      },
    };
    const driver = new S3Driver(client, "bucket", "tenant-1");
    await expect(
      driver.put("../other/file", Buffer.from("x"), "text/plain"),
    ).rejects.toThrow(/invalid/);
    expect(sent).toBe(0);
  });
});

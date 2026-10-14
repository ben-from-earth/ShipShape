import { afterEach, describe, expect, it } from "vitest";

import { putAttachment } from "./attachments";

const previous = process.env.ATTACHMENT_MAX_BYTES;

afterEach(() => {
  if (previous === undefined) {
    delete process.env.ATTACHMENT_MAX_BYTES;
  } else {
    process.env.ATTACHMENT_MAX_BYTES = previous;
  }
});

describe("attachment size limit", () => {
  it("rejects a body over ATTACHMENT_MAX_BYTES", async () => {
    process.env.ATTACHMENT_MAX_BYTES = "4";
    await expect(
      putAttachment("tenant-1", {
        fileName: "big.bin",
        contentType: "application/octet-stream",
        body: Buffer.from("12345"),
        size: 5,
      }),
    ).rejects.toThrow("Attachment is larger than 4 bytes.");
  });
});

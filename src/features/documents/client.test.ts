import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_DOCUMENT_UPLOAD_BYTES } from "@/config/documents";
import { DEMO_ORGANIZATION_ID, ORG_ID_HEADER } from "@/config/org";

import { DocsRequestError, searchDocuments, uploadDocument } from "./client";
import { DEMO_SEARCH_HITS } from "./fixtures";

const READABLE_ERRORS = [
  ["invalid_org_id", 400, "The organization id must be a UUID."],
  ["unknown_organization", 400, "No organization exists with that id."],
  ["payload_too_large", 413, "The file is larger than 10 MB."],
  [
    "unsupported_media_type",
    415,
    "Use a PDF, Word, plain text, or Markdown file.",
  ],
] as const;

const seal = () =>
  new File(["# seal"], "Seal check.md", { type: "text/markdown" });

const storedDocument = {
  id: "550e8400-e29b-41d4-a716-446655440099",
  orgId: DEMO_ORGANIZATION_ID,
  title: "Seal check",
  mediaType: "text/markdown",
  storageKey: "documents/seal-check.md",
  status: "indexed" as const,
  chunkCount: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("searchDocuments", () => {
  it("returns the route payload when search answers", async () => {
    const payload = {
      query: "hatch",
      hits: [DEMO_SEARCH_HITS[0]],
    };
    const fetchMock = vi.fn(async () => jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchDocuments({ query: "  hatch  " });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.documentTitle).toBe("Hull inspection notes");
    expect(fetchMock).toHaveBeenCalledWith("/api/documents/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [ORG_ID_HEADER]: DEMO_ORGANIZATION_ID,
      },
      body: JSON.stringify({ query: "hatch" }),
    });
  });

  it("sends the configured organization and shows the api error message", async () => {
    vi.stubEnv("NEXT_PUBLIC_ORG_ID", "550e8400-e29b-41d4-a716-446655440000");
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            code: "validation_error",
            message: "Request validation failed.",
            details: [{ path: "query", message: "Too small" }],
          },
        },
        400,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchDocuments({ query: "hatch" })).rejects.toMatchObject({
      kind: "http",
      status: 400,
      code: "validation_error",
      message: "Request validation failed.",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/search",
      expect.objectContaining({
        headers: expect.objectContaining({
          [ORG_ID_HEADER]: "550e8400-e29b-41d4-a716-446655440000",
        }),
      }),
    );
  });

  it("keeps a generic message when the error body is not apiErrorSchema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "nope" }, 400)),
    );

    await expect(searchDocuments({ query: "hatch" })).rejects.toMatchObject({
      kind: "http",
      status: 400,
      code: null,
      message: "Document search failed (400).",
    });
  });

  it.each(READABLE_ERRORS)(
    "maps %s to a readable message instead of the server text",
    async (code, status, message) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          jsonResponse({ error: { code, message: "raw server text" } }, status),
        ),
      );

      await expect(searchDocuments({ query: "hatch" })).rejects.toMatchObject({
        kind: "http",
        status,
        code,
        message,
      });
    },
  );

  it.each([400, 404, 409])(
    "rejects HTTP %s instead of returning demo hits",
    async (status) => {
      const fetchMock = vi.fn(async () => new Response("no", { status }));
      vi.stubGlobal("fetch", fetchMock);

      const error = await searchDocuments({ query: "bent support" }).catch(
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(DocsRequestError);
      expect(error).toMatchObject({
        kind: "http",
        status,
        message: `Document search failed (${status}).`,
      });
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it("rejects a network failure instead of returning demo hits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(
      searchDocuments({ query: "bent support" }),
    ).rejects.toMatchObject({
      name: "DocsRequestError",
      kind: "network",
      status: null,
      message: "Could not reach document search.",
    });
  });

  it("rejects a body that is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("not-json", {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    await expect(searchDocuments({ query: "hatch" })).rejects.toMatchObject({
      name: "DocsRequestError",
      kind: "parse",
      status: 200,
      message: "Document search returned an unexpected response.",
    });
  });

  it("rejects a JSON body that fails the search schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ query: "hatch" })),
    );

    await expect(searchDocuments({ query: "hatch" })).rejects.toMatchObject({
      kind: "parse",
      status: 200,
      message: "Document search returned an unexpected response.",
    });
  });

  it("returns ranked demo hits and does not call fetch when demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "true");
    const fetchMock = vi.fn(async () => jsonResponse({ query: "ignored" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchDocuments({ query: "bent support" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.query).toBe("bent support");
    expect(result.hits[0]?.documentTitle).toBe("Hull inspection notes");
    expect(result.hits[0]?.snippet).toBe("Bent support near the access hatch.");
    expect(result.hits[0]?.chunk.pageStart).toBe(4);
  });
});

describe("uploadDocument", () => {
  it("returns the stored document when upload answers", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ [ORG_ID_HEADER]: DEMO_ORGANIZATION_ID });
      expect(init.body).toBeInstanceOf(FormData);
      expect((init.body as FormData).get("file")).toBeInstanceOf(File);
      return jsonResponse(storedDocument, 201);
    });
    vi.stubGlobal("fetch", fetchMock);

    const document = await uploadDocument(seal());

    expect(document).toEqual(storedDocument);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it.each(READABLE_ERRORS)(
    "maps %s to a readable message instead of the server text",
    async (code, status, message) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          jsonResponse({ error: { code, message: "raw server text" } }, status),
        ),
      );

      await expect(uploadDocument(seal())).rejects.toMatchObject({
        kind: "http",
        status,
        code,
        message,
      });
    },
  );

  it.each([
    [413, "The file is larger than 10 MB."],
    [415, "Use a PDF, Word, plain text, or Markdown file."],
  ] as const)(
    "maps HTTP %s with no error schema to a readable message",
    async (status, message) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("no", { status })),
      );

      await expect(uploadDocument(seal())).rejects.toMatchObject({
        kind: "http",
        status,
        code: null,
        message,
      });
    },
  );

  it.each([400, 404, 409])(
    "rejects HTTP %s instead of a demo upload",
    async (status) => {
      const fetchMock = vi.fn(
        async () =>
          new Response("Server Action unavailable.", {
            status,
            headers: { "content-type": "text/plain" },
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await expect(uploadDocument(seal())).rejects.toMatchObject({
        name: "DocsRequestError",
        kind: "http",
        status,
        message: `Document upload failed (${status}).`,
      });
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it("rejects a network failure instead of a demo upload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(uploadDocument(seal())).rejects.toMatchObject({
      kind: "network",
      status: null,
      message: "Could not reach document upload.",
    });
  });

  it("rejects a body that is not the document schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ title: "Seal check" })),
    );

    await expect(uploadDocument(seal())).rejects.toMatchObject({
      kind: "parse",
      status: 200,
      message: "Document upload returned an unexpected response.",
    });
  });

  it("returns a typed demo document and does not call fetch when demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "true");
    const fetchMock = vi.fn(async () => jsonResponse(storedDocument));
    vi.stubGlobal("fetch", fetchMock);

    const document = await uploadDocument(seal());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(document).toMatchObject({
      title: "Seal check",
      mediaType: "text/markdown",
      orgId: DEMO_ORGANIZATION_ID,
      status: "indexed",
      chunkCount: 1,
    });
    expect(document.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("rejects an unsupported file in both modes without calling fetch", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(storedDocument));
    vi.stubGlobal("fetch", fetchMock);
    const photo = new File(["x"], "photo.png", { type: "image/png" });

    await expect(uploadDocument(photo)).rejects.toThrow(
      "Use a PDF, Word, plain text, or Markdown file.",
    );

    vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "true");
    await expect(uploadDocument(photo)).rejects.toThrow(
      "Use a PDF, Word, plain text, or Markdown file.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a file over 10 MB in both modes without calling fetch", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(storedDocument));
    vi.stubGlobal("fetch", fetchMock);
    const notes = new File(["x"], "notes.pdf", { type: "application/pdf" });
    Object.defineProperty(notes, "size", {
      value: MAX_DOCUMENT_UPLOAD_BYTES + 1,
    });

    await expect(uploadDocument(notes)).rejects.toThrow(
      "The file is larger than 10 MB.",
    );

    vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "true");
    await expect(uploadDocument(notes)).rejects.toThrow(
      "The file is larger than 10 MB.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { decryptDatabaseUrl, encryptDatabaseUrl } from "./tenant-secret";
import {
  INSERT_TENANT_SQL,
  LIST_TENANTS_SQL,
  formatRegistered,
  formatTenantList,
  isUniqueViolation,
  parseTenantArgs,
  registerTenant,
  resolveDatabaseUrl,
} from "./tenant-admin";

const originalKey = process.env.TENANT_SECRET_KEY;
const secretUrl = "postgresql://ship:secret@db.internal:5432/acme";

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.TENANT_SECRET_KEY;
  } else {
    process.env.TENANT_SECRET_KEY = originalKey;
  }
});

describe("tenant commands", () => {
  it("parses add and list arguments", () => {
    expect(
      parseTenantArgs([
        "add",
        "--slug",
        "acme",
        "--name",
        "Acme Repair",
        "--url",
        "TENANT_DATABASE_URL",
      ]),
    ).toEqual({
      command: "add",
      slug: "acme",
      name: "Acme Repair",
      urlFlag: "TENANT_DATABASE_URL",
    });
    expect(
      parseTenantArgs(["add", "--slug=acme", "--name=Acme", "--url=-"]),
    ).toEqual({
      command: "add",
      slug: "acme",
      name: "Acme",
      urlFlag: "-",
    });
    expect(
      parseTenantArgs([
        "add",
        "--slug",
        "acme",
        "--name",
        "Acme",
        "--url",
        "TENANT_DATABASE_URL",
        "--storage",
        "s3",
      ]),
    ).toEqual({
      command: "add",
      slug: "acme",
      name: "Acme",
      urlFlag: "TENANT_DATABASE_URL",
      storage: "s3",
    });
    expect(() =>
      parseTenantArgs([
        "add",
        "--slug",
        "acme",
        "--name",
        "Acme",
        "--url",
        "TENANT_DATABASE_URL",
        "--storage",
        "disk",
      ]),
    ).toThrow(/^--storage must be local or s3\.$/);
    expect(parseTenantArgs(["list"])).toEqual({ command: "list" });
    expect(() => parseTenantArgs(["list", "--slug", "acme"])).toThrow(
      /no arguments/,
    );
    expect(() =>
      parseTenantArgs([
        "add",
        "--slug",
        "Acme",
        "--name",
        "Acme",
        "--url",
        "X",
      ]),
    ).toThrow(/lowercase/);
  });

  it("reads the database URL from an env var or stdin", () => {
    expect(
      resolveDatabaseUrl({
        urlFlag: "TENANT_DATABASE_URL",
        env: { TENANT_DATABASE_URL: secretUrl },
      }),
    ).toBe(secretUrl);
    expect(
      resolveDatabaseUrl({
        urlFlag: "-",
        env: {},
        stdin: `\n${secretUrl}\n`,
      }),
    ).toBe(secretUrl);
    for (const urlFlag of [
      secretUrl,
      "postgres://ship:secret@db.internal/acme",
    ]) {
      expect(() => resolveDatabaseUrl({ urlFlag, env: {} })).toThrow(
        /^Do not pass a connection string to --url\. Use an environment variable name, or - to read stdin\.$/,
      );
    }
    expect(() =>
      resolveDatabaseUrl({ urlFlag: "TENANT_DATABASE_URL", env: {} }),
    ).toThrow(/TENANT_DATABASE_URL is not set/);
    expect(() =>
      resolveDatabaseUrl({
        urlFlag: "TENANT_DATABASE_URL",
        env: { TENANT_DATABASE_URL: "not-a-database" },
      }),
    ).toThrow(/^TENANT_DATABASE_URL must be a postgres connection string\.$/);
  });

  it("encrypts the URL, inserts ciphertext, then migrates that database", async () => {
    process.env.TENANT_SECRET_KEY = randomBytes(32).toString("base64");
    const calls: string[] = [];
    let stored = "";
    const registered = await registerTenant(
      { slug: "acme", name: "Acme", databaseUrl: secretUrl },
      {
        migrateControl: async () => {
          calls.push("control");
        },
        encrypt: (url) => {
          calls.push("encrypt");
          return encryptDatabaseUrl(url);
        },
        insert: async (row) => {
          calls.push("insert");
          stored = row.databaseUrlEncrypted;
          return { id: "71000000-0000-4000-8000-000000000001" };
        },
        migrateTenant: async (url) => {
          calls.push(`migrate:${url}`);
        },
      },
    );

    expect(calls).toEqual([
      "control",
      "encrypt",
      "insert",
      `migrate:${secretUrl}`,
    ]);
    expect(stored).not.toContain("secret");
    expect(decryptDatabaseUrl(stored)).toBe(secretUrl);
    expect(registered).toEqual({
      id: "71000000-0000-4000-8000-000000000001",
      slug: "acme",
      name: "Acme",
    });
    expect(JSON.stringify(registered)).not.toContain("secret");
    expect(formatRegistered(registered)).toBe(
      "Registered acme (71000000-0000-4000-8000-000000000001).",
    );
    expect(formatRegistered(registered)).not.toContain("secret");
  });

  it("does not migrate a tenant whose slug is already registered", async () => {
    let migrated = false;
    await expect(
      registerTenant(
        { slug: "acme", name: "Acme", databaseUrl: secretUrl },
        {
          migrateControl: async () => undefined,
          encrypt: () => "cipher",
          insert: async () => "exists",
          migrateTenant: async () => {
            migrated = true;
          },
        },
      ),
    ).rejects.toThrow(/already registered/);
    expect(migrated).toBe(false);
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "42P01" })).toBe(false);
  });

  it("lists slug, name, id, and created time without a connection string", () => {
    expect(LIST_TENANTS_SQL).not.toMatch(
      /database_url|storage_config|password|secret/i,
    );
    expect(INSERT_TENANT_SQL).toContain("database_url_encrypted");
    const listed = formatTenantList([
      {
        id: "71000000-0000-4000-8000-000000000001",
        slug: "acme",
        name: "Acme",
        createdAt: "2026-10-14T00:00:00.000Z",
      },
    ]);
    expect(listed).toBe(
      [
        "slug\tname\tid\tcreated_at",
        "acme\tAcme\t71000000-0000-4000-8000-000000000001\t2026-10-14T00:00:00.000Z",
      ].join("\n"),
    );
    expect(listed).not.toContain("postgres");
    expect(listed).not.toContain("secret");
  });
});

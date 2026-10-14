import { EventEmitter } from "node:events";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertClientMajor,
  attachmentArchivePath,
  backupTenant,
  commandEnv,
  defaultDumpPath,
  libpqEnv,
  parseTenantBackupArgs,
  pgDumpArgs,
  pgRestoreArgs,
  redactSecrets,
  resolveBackupTarget,
  restoreTenant,
  type BackupDeps,
  type BackupTarget,
} from "./tenant-backup";

const spawn = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn,
}));

const secretUrl =
  "postgresql://ship:super-secret-pw@db.internal:5432/shipshape?sslmode=require";
const tenantId = "71000000-0000-4000-8000-0000000000aa";

type SpawnCall = {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
};

function fakeChild(result: {
  code?: number;
  stdout?: string;
  stderr?: string;
}) {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = stdout;
  child.stderr = stderr;
  queueMicrotask(() => {
    if (result.stdout) {
      stdout.emit("data", Buffer.from(result.stdout));
    }
    if (result.stderr) {
      stderr.emit("data", Buffer.from(result.stderr));
    }
    child.emit("close", result.code ?? 0, null);
  });
  return child;
}

function calls(): SpawnCall[] {
  return spawn.mock.calls.map((call) => {
    const [command, args, options] = call as [
      string,
      string[],
      { env: NodeJS.ProcessEnv },
    ];
    return { command, args, env: options.env };
  });
}

function assertUrlStaysOffArgv(recorded: readonly SpawnCall[]): void {
  for (const call of recorded) {
    const rendered = [call.command, ...call.args].join(" ");
    expect(rendered).not.toContain("super-secret-pw");
    expect(rendered).not.toContain("postgresql://");
    expect(rendered).not.toContain("postgres://");
    expect(call.env.PGPASSWORD).not.toBe(secretUrl);
  }
}

describe("tenant backup arguments", () => {
  it("parses backup and restore flags", () => {
    expect(parseTenantBackupArgs(["backup", "--slug", "acme"])).toEqual({
      command: "backup",
      slug: "acme",
    });
    expect(
      parseTenantBackupArgs([
        "backup",
        "--slug=acme",
        "--out=backups/acme.dump",
      ]),
    ).toEqual({
      command: "backup",
      slug: "acme",
      out: "backups/acme.dump",
    });
    expect(
      parseTenantBackupArgs([
        "restore",
        "--slug",
        "acme",
        "--file",
        "backups/acme.dump",
        "--confirm",
        "acme",
      ]),
    ).toEqual({
      command: "restore",
      slug: "acme",
      file: "backups/acme.dump",
      confirm: "acme",
    });
  });

  it("rejects missing flags, a bad slug, and a confirm mismatch", () => {
    expect(() => parseTenantBackupArgs(["backup"])).toThrow(
      /^tenant:backup requires --slug\.$/,
    );
    expect(() => parseTenantBackupArgs(["restore", "--slug", "acme"])).toThrow(
      /^tenant:restore requires --slug, --file, and --confirm\.$/,
    );
    expect(() =>
      parseTenantBackupArgs([
        "restore",
        "--slug",
        "acme",
        "--file",
        "backups/acme.dump",
        "--confirm",
        "other",
      ]),
    ).toThrow(/^--confirm must match --slug\.$/);
    expect(() => parseTenantBackupArgs(["backup", "--slug", "Acme"])).toThrow(
      /^Slug must be lowercase letters, numbers, and hyphens\.$/,
    );
    const urlSlug = "postgresql://ship:super-secret-pw@db.internal/shipshape";
    expect(() => parseTenantBackupArgs(["backup", "--slug", urlSlug])).toThrow(
      /lowercase/,
    );
    try {
      parseTenantBackupArgs(["backup", "--slug", urlSlug]);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain("super-secret-pw");
      expect((error as Error).message).not.toContain("postgresql://");
    }
  });
});

describe("pg_dump invocation", () => {
  const localTarget: BackupTarget = {
    databaseUrl: secretUrl,
    tenantId,
    storage: { kind: "local", rootDir: "/var/lib/shipshape/files" },
  };

  beforeEach(() => {
    spawn.mockReset();
  });

  it("passes the database through PG* env vars and never on argv", async () => {
    spawn.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "--version") {
        return fakeChild({ stdout: "pg_dump (PostgreSQL) 18.1\n" });
      }
      if (command === "tar") {
        return fakeChild({});
      }
      return fakeChild({});
    });
    const message = await backupTenant(
      { slug: "acme" },
      deps(localTarget, async () => true),
    );

    const recorded = calls();
    expect(recorded.map((call) => call.command)).toEqual([
      "pg_dump",
      "pg_dump",
      "tar",
    ]);
    expect(recorded[0]?.args).toEqual(["--version"]);
    expect(recorded[1]?.args).toEqual(
      pgDumpArgs(
        defaultDumpPath("/work", "acme", new Date("2026-10-14T16:41:00.000Z")),
      ),
    );
    expect(recorded[1]?.env.PGHOST).toBe("db.internal");
    expect(recorded[1]?.env.PGPORT).toBe("5432");
    expect(recorded[1]?.env.PGUSER).toBe("ship");
    expect(recorded[1]?.env.PGPASSWORD).toBe("super-secret-pw");
    expect(recorded[1]?.env.PGDATABASE).toBe("shipshape");
    expect(recorded[1]?.env.PGSSLMODE).toBe("require");
    expect(recorded[1]?.env.DATABASE_URL).toBeUndefined();
    expect(recorded[2]?.args).toEqual([
      "-cf",
      attachmentArchivePath(
        defaultDumpPath("/work", "acme", new Date("2026-10-14T16:41:00.000Z")),
      ),
      "-C",
      "/var/lib/shipshape/files",
      tenantId,
    ]);
    assertUrlStaysOffArgv(recorded);
    expect(message).toContain("Backed up acme to");
    expect(message).toContain("Backed up local attachments to");
    expect(message).not.toContain("super-secret-pw");
    expect(message).not.toContain("postgresql://");
  });

  it("does not spawn pg_dump when the client is older than the server", async () => {
    spawn.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === "--version") {
        return fakeChild({ stdout: "pg_dump (PostgreSQL) 16.4\n" });
      }
      return fakeChild({});
    });

    await expect(
      backupTenant(
        { slug: "acme" },
        deps(localTarget, async () => false),
      ),
    ).rejects.toThrow(
      "pg_dump 16 is older than the Postgres server (18). Install the PostgreSQL 18 client tools.",
    );
    expect(calls().map((call) => call.args[0])).toEqual(["--version"]);
    assertUrlStaysOffArgv(calls());
  });

  it("redacts the database URL from pg_dump errors", async () => {
    spawn.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === "--version") {
        return fakeChild({ stdout: "pg_dump (PostgreSQL) 18.1\n" });
      }
      return fakeChild({
        code: 1,
        stderr: `connection failed for ${secretUrl}`,
      });
    });

    await expect(
      backupTenant(
        { slug: "acme" },
        deps(localTarget, async () => false),
      ),
    ).rejects.toThrow(/pg_dump failed: connection failed for \[redacted\]/);
  });

  it("leaves S3 objects out of the archive", async () => {
    spawn.mockImplementation((_command: string, args: string[]) =>
      fakeChild({
        stdout: args[0] === "--version" ? "pg_dump (PostgreSQL) 18.1\n" : "",
      }),
    );
    const message = await backupTenant(
      { slug: "acme", out: "backups/acme.dump" },
      deps({ ...localTarget, storage: { kind: "s3" } }, async () => {
        throw new Error("exists should not be called for s3");
      }),
    );
    expect(calls().some((call) => call.command === "tar")).toBe(false);
    expect(message).toContain(
      "S3 attachments are not included. Use bucket versioning.",
    );
    assertUrlStaysOffArgv(calls());
  });
});

describe("tenant restore confirm guard", () => {
  beforeEach(() => {
    spawn.mockReset();
  });

  it("refuses a mismatched confirm before spawning a process", async () => {
    const resolveTenant = vi.fn(async () => {
      throw new Error("should not resolve");
    });
    await expect(
      restoreTenant(
        { slug: "acme", file: "backups/acme.dump", confirm: "other" },
        {
          ...deps(
            {
              databaseUrl: secretUrl,
              tenantId,
              storage: { kind: "local", rootDir: "/var/lib/files" },
            },
            async () => true,
          ),
          resolveTenant,
        },
      ),
    ).rejects.toThrow(/^--confirm must match --slug\.$/);
    expect(spawn).not.toHaveBeenCalled();
    expect(resolveTenant).not.toHaveBeenCalled();
  });

  it("restores with pg_restore args that omit the connection string", async () => {
    spawn.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "--version") {
        return fakeChild({ stdout: "pg_restore (PostgreSQL) 18.0\n" });
      }
      return fakeChild({});
    });
    let migrated = false;
    const message = await restoreTenant(
      { slug: "acme", file: "backups/acme.dump", confirm: "acme" },
      {
        ...deps(
          {
            databaseUrl: secretUrl,
            tenantId,
            storage: { kind: "s3" },
          },
          async (filePath) => filePath === "backups/acme.dump",
        ),
        migrateTenant: async (url) => {
          if (url !== secretUrl) {
            throw new Error("migrate received an unexpected database URL.");
          }
          migrated = true;
        },
      },
    );

    const recorded = calls();
    expect(recorded.map((call) => [call.command, call.args[0]])).toEqual([
      ["pg_restore", "--version"],
      ["pg_restore", "--clean"],
    ]);
    expect(recorded[1]?.args).toEqual(
      pgRestoreArgs("shipshape", "backups/acme.dump"),
    );
    expect(recorded[1]?.env.PGPASSWORD).toBe("super-secret-pw");
    assertUrlStaysOffArgv(recorded);
    expect(migrated).toBe(true);
    expect(message).toBe("Restored acme from backups/acme.dump.");
    expect(message).not.toContain("super-secret-pw");
  });
});

describe("backup helpers", () => {
  it("requires a PostgreSQL 18 client", () => {
    expect(() =>
      assertClientMajor("pg_dump", "pg_dump (PostgreSQL) 18.1", 180001),
    ).not.toThrow();
    expect(() =>
      assertClientMajor("pg_dump", "pg_dump (PostgreSQL) 17.2", 160004),
    ).toThrow(/pg_dump 17 is not the PostgreSQL 18 client/);
    expect(libpqEnv(secretUrl).PGPASSWORD).toBe("super-secret-pw");
    expect(redactSecrets(`nope ${secretUrl}`, [secretUrl])).toBe(
      "nope [redacted]",
    );
    const env = commandEnv(
      { DATABASE_URL: secretUrl, PATH: "/usr/bin" },
      libpqEnv(secretUrl),
      [secretUrl, "super-secret-pw"],
    );
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.PGPASSWORD).toBe("super-secret-pw");
    expect(env.PATH).toBe("/usr/bin");
  });

  it("uses DATABASE_URL when the control database is unset", async () => {
    await expect(
      resolveBackupTarget("acme", { STORAGE_KIND: "local" }),
    ).rejects.toThrow(/DATABASE_URL is not set/);
    const local = await resolveBackupTarget("acme", {
      DATABASE_URL: secretUrl,
      STORAGE_KIND: "local",
      STORAGE_LOCAL_DIR: "/var/lib/files",
    });
    expect(local.databaseUrl).toBe(secretUrl);
    expect(local.tenantId).toBeNull();
    expect(local.storage).toEqual({ kind: "local", rootDir: "/var/lib/files" });
    const s3 = await resolveBackupTarget("acme", {
      DATABASE_URL: secretUrl,
      STORAGE_KIND: "s3",
    });
    expect(s3.storage).toEqual({ kind: "s3" });
  });
});

function deps(
  target: BackupTarget,
  exists: (filePath: string) => Promise<boolean>,
): BackupDeps {
  return {
    serverVersion: async (url) => {
      if (url !== secretUrl) {
        throw new Error("server version received an unexpected database URL.");
      }
      return 180001;
    },
    resolveTenant: async () => target,
    migrateTenant: async () => undefined,
    now: () => new Date("2026-10-14T16:41:00.000Z"),
    exists,
    mkdir: async () => undefined,
    env: { DATABASE_URL: secretUrl, PATH: "/usr/bin" },
    cwd: "/work",
  };
}

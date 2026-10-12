import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import type { Database } from "./index";
import {
  ISSUE_CODE_PREFIX,
  formatIssueCode,
  nextIssueCodeSql,
} from "./issue-code";
import { issues } from "./schema";
import { demoIssue } from "./demo-seed";

describe("issue code format", () => {
  it("matches the demo seed and does not truncate wider numbers", () => {
    expect(demoIssue.code).toBe("ISS-1001");
    expect(formatIssueCode(1001)).toBe(demoIssue.code);
    expect(formatIssueCode(1002)).toBe("ISS-1002");
    expect(formatIssueCode(42)).toBe("ISS-0042");
    expect(formatIssueCode(10000)).toBe("ISS-10000");
    expect(formatIssueCode("1002")).toBe("ISS-1002");
  });

  it("allocates a code with one nextval call", () => {
    const query = new PgDialect().sqlToQuery(nextIssueCodeSql());

    expect(query.sql.match(/nextval/g)).toHaveLength(1);
    expect(query.sql).toContain("'issue_code_seq'::regclass");
    expect(query.sql).toContain("'ISS-'");
    expect(query.params).toEqual([]);
  });

  it("can be used as the code value inside db.batch", () => {
    function batchInsert(db: Database, assetId: string) {
      return db.batch([
        db.insert(issues).values({
          code: nextIssueCodeSql(),
          assetId,
          severity: "medium",
          description: "Allocated issue code",
        }),
      ]);
    }

    expect(batchInsert).toEqual(expect.any(Function));
    expect(ISSUE_CODE_PREFIX).toBe("ISS-");
  });
});

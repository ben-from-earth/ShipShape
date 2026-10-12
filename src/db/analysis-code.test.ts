import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { formatAnalysisCode, nextAnalysisCodeSql } from "./analysis-code";
import { demoAnalysis } from "./demo-seed";

describe("analysis code format", () => {
  it("matches the demo seed and does not truncate wider numbers", () => {
    expect(demoAnalysis.code).toBe("AN-1001");
    expect(formatAnalysisCode(1001)).toBe(demoAnalysis.code);
    expect(formatAnalysisCode(1002)).toBe("AN-1002");
    expect(formatAnalysisCode(42)).toBe("AN-0042");
    expect(formatAnalysisCode(10000)).toBe("AN-10000");
    expect(formatAnalysisCode("1002")).toBe("AN-1002");
  });

  it("allocates a code with one nextval call", () => {
    const query = new PgDialect().sqlToQuery(nextAnalysisCodeSql());

    expect(query.sql.match(/nextval/g)).toHaveLength(1);
    expect(query.sql).toContain("'analysis_code_seq'::regclass");
    expect(query.sql).toContain("'AN-'");
    expect(query.params).toEqual([]);
  });
});

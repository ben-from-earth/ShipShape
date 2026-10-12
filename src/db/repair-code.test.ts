import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { demoRepair } from "./demo-seed";
import {
  REPAIR_CODE_PREFIX,
  formatRepairCode,
  nextRepairCodeSql,
} from "./repair-code";

describe("repair code format", () => {
  it("matches the demo seed and does not truncate wider numbers", () => {
    expect(demoRepair.code).toBe("REP-1001");
    expect(formatRepairCode(1001)).toBe(demoRepair.code);
    expect(formatRepairCode(1002)).toBe("REP-1002");
    expect(formatRepairCode(42)).toBe("REP-0042");
    expect(formatRepairCode(10000)).toBe("REP-10000");
    expect(formatRepairCode("1002")).toBe("REP-1002");
    expect(REPAIR_CODE_PREFIX).toBe("REP-");
  });

  it("allocates a code with one nextval call", () => {
    const query = new PgDialect().sqlToQuery(nextRepairCodeSql());

    expect(query.sql.match(/nextval/g)).toHaveLength(1);
    expect(query.sql).toContain("'repair_code_seq'::regclass");
    expect(query.sql).toContain("'REP-'");
    expect(query.params).toEqual([]);
  });
});

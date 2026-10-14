import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ANALYSIS_TRANSITIONS,
  analysisActionSchema,
  analysisAttachmentSchema,
  analysisCommentSchema,
  analysisCreateBodySchema,
  analysisCreateSchema,
  analysisSchema,
  analysisStatusSchema,
  analysisTransitionBodySchema,
  analysisTransitionResultSchema,
  canPerform,
  commentCreateBodySchema,
  createAnalysisResultSchema,
  ENGINEER_ROLE_RANK,
  engineerCreateSchema,
  engineerRoleSchema,
  engineerSchema,
} from "@/schemas";

const analysisId = "550e8400-e29b-41d4-a716-446655440051";
const assigneeId = "550e8400-e29b-41d4-a716-446655440011";
const authorId = "550e8400-e29b-41d4-a716-446655440012";
const documentId = "550e8400-e29b-41d4-a716-446655440061";
const createdAt = "2026-10-12T21:04:00.000Z";

const record = {
  id: analysisId,
  code: "AN-1002",
  title: "Limit check",
  status: "unassigned" as const,
  assigneeId: null,
  dueDate: null,
  createdAt,
  updatedAt: createdAt,
  approvedAt: null,
  createdBy: null,
};

describe("engineer schemas", () => {
  it("orders roles so each rank inherits the lower ones", () => {
    expect(engineerRoleSchema.options).toEqual([
      "analyst",
      "reviewer",
      "approver",
    ]);
    expect(ENGINEER_ROLE_RANK).toEqual({
      analyst: 0,
      reviewer: 1,
      approver: 2,
    });
    const roles = engineerRoleSchema.options;
    for (let index = 1; index < roles.length; index += 1) {
      const lower = roles[index - 1];
      const higher = roles[index];
      expect(lower).toBeDefined();
      expect(higher).toBeDefined();
      if (lower === undefined || higher === undefined) {
        continue;
      }
      expect(ENGINEER_ROLE_RANK[higher]).toBeGreaterThan(
        ENGINEER_ROLE_RANK[lower],
      );
    }
  });

  it("accepts an engineer and a create payload", () => {
    expect(
      engineerCreateSchema.parse({
        name: "  Ada Lovelace  ",
        email: "  ada@example.com  ",
        role: "reviewer",
      }),
    ).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "reviewer",
    });
    expect(
      engineerSchema.parse({
        id: assigneeId,
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "analyst",
        createdAt,
      }).role,
    ).toBe("analyst");
    expect(
      engineerCreateSchema.safeParse({
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "reviewer",
        id: assigneeId,
      }).success,
    ).toBe(false);
  });
});

describe("analyses schemas", () => {
  it("accepts the create payload and the stored record", () => {
    expect(
      analysisCreateSchema.parse({
        title: "  Limit check  ",
        dueDate: " 2026-12-01 ",
        assigneeId,
      }),
    ).toEqual({
      title: "Limit check",
      dueDate: "2026-12-01",
      assigneeId,
    });
    expect(analysisCreateSchema.parse({ title: "Limit check" })).toEqual({
      title: "Limit check",
    });
    expect(
      analysisCreateSchema.safeParse({
        title: "Limit check",
        repairId: "550e8400-e29b-41d4-a716-446655440041",
        margin: 0.05,
        method: "hand calc",
        loadCase: "Primary",
      }).success,
    ).toBe(false);
    expect(
      analysisCreateSchema.safeParse({
        title: "Limit check",
        dueDate: null,
      }).success,
    ).toBe(false);
    expect(analysisSchema.parse(record)).toEqual(record);
    expect(createAnalysisResultSchema).toBe(analysisSchema);
    expect(analysisCreateBodySchema).toBe(analysisCreateSchema);
    expect(analysisTransitionResultSchema).toBe(analysisSchema);
  });

  it("accepts a create body without a repair id", () => {
    expect(
      analysisCreateBodySchema.parse({
        title: "  Limit check  ",
      }),
    ).toEqual({
      title: "Limit check",
    });
    expect(
      analysisCreateBodySchema.safeParse({
        title: "Limit check",
        repairId: analysisId,
      }).success,
    ).toBe(false);
  });

  it("rejects the retired status and margin fields", () => {
    expect(analysisStatusSchema.safeParse("draft").success).toBe(false);
    expect(
      analysisSchema.safeParse({
        ...record,
        margin: 0.05,
      }).success,
    ).toBe(false);
  });

  it("lists every transition once", () => {
    expect(analysisActionSchema.options).toEqual([
      "assign",
      "start",
      "submit",
      "pick_up",
      "send_back",
      "approve",
    ]);
    expect(ANALYSIS_TRANSITIONS).toEqual({
      assign: {
        from: "unassigned",
        to: "assigned",
        minRole: "reviewer",
        assignedAnalyst: false,
        requiresAssignee: true,
      },
      start: {
        from: "assigned",
        to: "in_progress",
        minRole: "analyst",
        assignedAnalyst: true,
        requiresAssignee: false,
      },
      submit: {
        from: "in_progress",
        to: "waiting_for_review",
        minRole: "analyst",
        assignedAnalyst: true,
        requiresAssignee: false,
      },
      pick_up: {
        from: "waiting_for_review",
        to: "in_review",
        minRole: "reviewer",
        assignedAnalyst: false,
        requiresAssignee: false,
      },
      send_back: {
        from: "in_review",
        to: "in_progress",
        minRole: "reviewer",
        assignedAnalyst: false,
        requiresAssignee: false,
      },
      approve: {
        from: "in_review",
        to: "approved",
        minRole: "approver",
        assignedAnalyst: false,
        requiresAssignee: false,
      },
    });
    expect(Object.keys(ANALYSIS_TRANSITIONS)).toEqual([
      ...analysisActionSchema.options,
    ]);
    for (const action of analysisActionSchema.options) {
      const transition = ANALYSIS_TRANSITIONS[action];
      expect(analysisStatusSchema.safeParse(transition.from).success).toBe(
        true,
      );
      expect(analysisStatusSchema.safeParse(transition.to).success).toBe(true);
    }
  });

  it("requires assigneeId only when assigning", () => {
    expect(
      analysisTransitionBodySchema.safeParse({ action: "assign" }).success,
    ).toBe(false);
    expect(
      analysisTransitionBodySchema.parse({
        action: "assign",
        assigneeId,
      }),
    ).toEqual({ action: "assign", assigneeId });
    expect(analysisTransitionBodySchema.parse({ action: "start" })).toEqual({
      action: "start",
    });
    expect(
      analysisTransitionBodySchema.parse({
        action: "approve",
        assigneeId,
      }),
    ).toEqual({ action: "approve", assigneeId });
    expect(
      analysisTransitionBodySchema.safeParse({
        action: "start",
        repairId: analysisId,
      }).success,
    ).toBe(false);
  });

  it("lets a role perform an action when its rank meets the minimum", () => {
    expect(canPerform("analyst", "start")).toBe(true);
    expect(canPerform("analyst", "submit")).toBe(true);
    expect(canPerform("analyst", "assign")).toBe(false);
    expect(canPerform("analyst", "pick_up")).toBe(false);
    expect(canPerform("analyst", "send_back")).toBe(false);
    expect(canPerform("analyst", "approve")).toBe(false);

    expect(canPerform("reviewer", "assign")).toBe(true);
    expect(canPerform("reviewer", "start")).toBe(true);
    expect(canPerform("reviewer", "submit")).toBe(true);
    expect(canPerform("reviewer", "pick_up")).toBe(true);
    expect(canPerform("reviewer", "send_back")).toBe(true);
    expect(canPerform("reviewer", "approve")).toBe(false);

    expect(canPerform("approver", "assign")).toBe(true);
    expect(canPerform("approver", "start")).toBe(true);
    expect(canPerform("approver", "approve")).toBe(true);

    for (const action of analysisActionSchema.options) {
      const minimum = ENGINEER_ROLE_RANK[ANALYSIS_TRANSITIONS[action].minRole];
      for (const role of engineerRoleSchema.options) {
        expect(canPerform(role, action)).toBe(
          ENGINEER_ROLE_RANK[role] >= minimum,
        );
      }
    }
  });

  it("accepts a comment and either kind of attachment", () => {
    expect(commentCreateBodySchema.parse({ body: "  Looks good.  " })).toEqual({
      body: "Looks good.",
    });
    expect(
      analysisCommentSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440071",
        analysisId,
        authorId,
        body: "Looks good.",
        createdAt,
      }).authorId,
    ).toBe(authorId);
    expect(
      analysisCommentSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440071",
        analysisId,
        authorId: null,
        body: "Looks good.",
        createdAt,
      }).authorId,
    ).toBeNull();

    const shared = {
      id: "550e8400-e29b-41d4-a716-446655440081",
      analysisId,
      uploadedBy: null,
      createdAt,
    };
    expect(analysisAttachmentSchema.parse({ ...shared, documentId })).toEqual({
      ...shared,
      documentId,
    });
    expect(
      analysisAttachmentSchema.parse({
        ...shared,
        fileName: " calc.pdf ",
        url: "https://files.example.com/calc.pdf",
        contentType: " application/pdf ",
        size: 1200,
      }),
    ).toEqual({
      ...shared,
      fileName: "calc.pdf",
      url: "https://files.example.com/calc.pdf",
      contentType: "application/pdf",
      size: 1200,
    });
    expect(
      analysisAttachmentSchema.parse({
        ...shared,
        storageKey:
          " attachments/550e8400-e29b-41d4-a716-446655440082/calc.pdf ",
        fileName: " calc.pdf ",
        contentType: " application/pdf ",
        size: 1200,
      }),
    ).toEqual({
      ...shared,
      storageKey: "attachments/550e8400-e29b-41d4-a716-446655440082/calc.pdf",
      fileName: "calc.pdf",
      contentType: "application/pdf",
      size: 1200,
    });
    expect(
      analysisAttachmentSchema.safeParse({
        ...shared,
        documentId,
        fileName: "calc.pdf",
        url: "https://files.example.com/calc.pdf",
        contentType: "application/pdf",
        size: 1200,
      }).success,
    ).toBe(false);
  });

  it("lives only in the client-safe analyses module", () => {
    const root = process.cwd();
    const source = readFileSync(
      path.join(root, "src/schemas/analyses.ts"),
      "utf8",
    );
    const engineers = readFileSync(
      path.join(root, "src/schemas/engineers.ts"),
      "utf8",
    );

    for (const file of [source, engineers]) {
      expect(file).not.toContain("server-only");
      expect(file).not.toContain("@/db");
      expect(file).not.toContain("@/server");
    }
    expect(source).not.toContain("analysisMarginSchema");
    expect(source).not.toContain("analysisConclusionSchema");
    expect(source).not.toContain("analysisDbStatusSchema");
    expect(source).not.toContain("loadCase");
    expect(source).not.toContain("repairId");
    expect(existsSync(path.join(root, "src/schemas/analysis.ts"))).toBe(false);
    expect(existsSync(path.join(root, "src/schemas/engineer.ts"))).toBe(false);
  });
});

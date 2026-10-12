import {
  MAX_REPAIR_TITLE_LENGTH,
  MAX_REPAIR_TYPE_LENGTH,
} from "@/config/repairs";
import { createRepairFieldsSchema, type CreateRepairFields } from "@/schemas";

export type RepairDraft = {
  title: string;
  type: string;
  status: string;
};

export type RepairFormField = "title" | "type" | "status";

/** Fields the create-repair form can show. Blank type and status are omitted. */
export function repairPayload(draft: RepairDraft): {
  title: string;
  type?: string;
  status?: string;
} {
  const payload: { title: string; type?: string; status?: string } = {
    title: draft.title,
  };
  if (draft.type.trim()) {
    payload.type = draft.type;
  }
  if (draft.status.trim()) {
    payload.status = draft.status;
  }
  return payload;
}

/**
 * Problems with a create-repair draft, checked with `createRepairFieldsSchema`.
 * An empty object means the draft can be posted.
 */
export function repairFormErrors(
  draft: RepairDraft,
): Partial<Record<RepairFormField, string>> {
  const parsed = createRepairFieldsSchema.safeParse(repairPayload(draft));
  if (parsed.success) {
    return {};
  }

  const errors: Partial<Record<RepairFormField, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (key === "title" && !errors.title) {
      errors.title =
        draft.title.trim().length > MAX_REPAIR_TITLE_LENGTH
          ? "Title is too long."
          : "A title is required.";
    } else if (key === "type" && !errors.type) {
      errors.type =
        draft.type.trim().length > MAX_REPAIR_TYPE_LENGTH
          ? "Type is too long."
          : "Type is not valid.";
    } else if (key === "status" && !errors.status) {
      errors.status = "Choose a status.";
    }
  }

  return errors;
}

/** Parsed body for POST /api/findings/[id]/repairs. Throws when the draft is invalid. */
export function toRepairFields(draft: RepairDraft): CreateRepairFields {
  return createRepairFieldsSchema.parse(repairPayload(draft));
}

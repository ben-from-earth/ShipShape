import { isDemoData } from "@/config/demo";
import { ORG_ID_HEADER, orgId } from "@/config/org";
import {
  apiErrorSchema,
  createRepairResultSchema,
  type ApiErrorDetail,
  type ApiErrorCode,
  type CreateRepairResult,
} from "@/schemas";

import { toRepairFields, type RepairDraft, type RepairFormField } from "./form";

export type RepairRequestKind = "network" | "http" | "parse";

const GENERIC_REPAIR_ERROR = "Could not create the repair.";
const NOT_FOUND_MESSAGE = "Finding not found.";

const REPAIR_FIELDS = new Set<RepairFormField>(["title", "type", "status"]);

/**
 * A repair that was not recorded.
 * `network` means `fetch` threw. `http` is any non-2xx status.
 * `parse` means the body was not the 201 schema.
 */
export class RepairRequestError extends Error {
  readonly kind: RepairRequestKind;
  readonly status: number | null;
  readonly code: ApiErrorCode | null;
  readonly details: readonly ApiErrorDetail[];

  constructor(
    message: string,
    options: {
      kind: RepairRequestKind;
      status?: number | null;
      code?: ApiErrorCode | null;
      details?: readonly ApiErrorDetail[];
      cause?: unknown;
    },
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "RepairRequestError";
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.details = options.details ?? [];
  }
}

/**
 * Where a failed create should be shown.
 * A 400 `validation_error` detail on `title`, `type`, or `status` is a field.
 * Path `body`, and any other path, is a form-level error.
 */
export function repairRequestProblems(error: RepairRequestError): {
  form: string | null;
  fields: Partial<Record<RepairFormField, string>>;
} {
  if (error.status === 404) {
    return { form: NOT_FOUND_MESSAGE, fields: {} };
  }

  if (error.status === 400 && error.code === "validation_error") {
    const fields: Partial<Record<RepairFormField, string>> = {};
    const formMessages: string[] = [];

    for (const detail of error.details) {
      if (isRepairField(detail.path)) {
        if (!fields[detail.path]) {
          fields[detail.path] = detail.message;
        }
      } else if (detail.message) {
        formMessages.push(detail.message);
      }
    }

    if (formMessages.length === 0 && Object.keys(fields).length === 0) {
      formMessages.push(error.message || GENERIC_REPAIR_ERROR);
    }

    return {
      form: formMessages.length > 0 ? formMessages.join(" ") : null,
      fields,
    };
  }

  return { form: GENERIC_REPAIR_ERROR, fields: {} };
}

function isRepairField(path: string): path is RepairFormField {
  return REPAIR_FIELDS.has(path as RepairFormField);
}

function messageFor(
  status: number,
  code: ApiErrorCode | null,
  apiMessage: string | null,
): string {
  if (status === 404) {
    return NOT_FOUND_MESSAGE;
  }

  if (status === 400 && code === "validation_error") {
    return apiMessage || GENERIC_REPAIR_ERROR;
  }

  return GENERIC_REPAIR_ERROR;
}

function readErrorBody(payload: unknown): {
  code: ApiErrorCode | null;
  message: string | null;
  details: ApiErrorDetail[];
} {
  const parsed = apiErrorSchema.safeParse(payload);
  if (!parsed.success) {
    return { code: null, message: null, details: [] };
  }

  return {
    code: parsed.data.error.code,
    message: parsed.data.error.message,
    details: parsed.data.error.details ?? [],
  };
}

function httpFailure(
  status: number,
  code: ApiErrorCode | null = null,
  apiMessage: string | null = null,
  details: readonly ApiErrorDetail[] = [],
): RepairRequestError {
  return new RepairRequestError(messageFor(status, code, apiMessage), {
    kind: "http",
    status,
    code,
    details,
  });
}

async function errorFromResponse(
  response: Response,
): Promise<RepairRequestError> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return httpFailure(response.status);
  }

  const body = readErrorBody(payload);
  return httpFailure(response.status, body.code, body.message, body.details);
}

function demoCreated(
  findingId: string,
  draft: RepairDraft,
): CreateRepairResult {
  const fields = toRepairFields(draft);
  const createdAt = new Date().toISOString();

  return createRepairResultSchema.parse({
    id: crypto.randomUUID(),
    code: "REP-DEMO",
    findingId,
    title: fields.title,
    type: fields.type ?? null,
    status: fields.status ?? "open",
    createdBy: null,
    createdAt,
    updatedAt: createdAt,
  });
}

/**
 * POST /api/findings/[id]/repairs with `{ title, type?, status? }` and `x-org-id`.
 * Demo mode returns a local 201 and does not call `fetch`.
 */
export async function createRepair(
  findingId: string,
  draft: RepairDraft,
): Promise<CreateRepairResult> {
  const fields = toRepairFields(draft);

  if (isDemoData()) {
    return demoCreated(findingId, draft);
  }

  let response: Response;
  try {
    response = await fetch(
      `/api/findings/${encodeURIComponent(findingId)}/repairs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [ORG_ID_HEADER]: orgId(),
        },
        body: JSON.stringify(fields),
      },
    );
  } catch (cause) {
    throw new RepairRequestError("Could not reach repairs.", {
      kind: "network",
      cause,
    });
  }

  if (!response.ok) {
    throw await errorFromResponse(response);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new RepairRequestError("Repairs returned an unexpected response.", {
      kind: "parse",
      status: response.status,
      cause,
    });
  }

  const parsed = createRepairResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new RepairRequestError("Repairs returned an unexpected response.", {
      kind: "parse",
      status: response.status,
      cause: parsed.error,
    });
  }

  return parsed.data;
}

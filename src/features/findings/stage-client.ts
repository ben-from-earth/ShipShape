import { isDemoData } from "@/config/demo";
import { ORG_ID_HEADER, orgId } from "@/config/org";
import {
  advanceFindingStageResultSchema,
  apiErrorSchema,
  type AdvanceFindingStageResult,
  type ApiErrorCode,
  type FindingStage,
} from "@/schemas";

export type StageRequestKind = "network" | "http" | "parse";

const GENERIC_STAGE_ERROR = "Could not change the stage.";
const NOT_FOUND_MESSAGE = "Finding not found.";
const CONFLICT_MESSAGE = "This finding was moved by someone else.";

/**
 * A stage change that was not recorded.
 * `network` means `fetch` threw. `http` is any non-2xx status.
 * `parse` means the body was not the 200 schema.
 */
export class StageRequestError extends Error {
  readonly kind: StageRequestKind;
  readonly status: number | null;
  readonly code: ApiErrorCode | null;

  constructor(
    message: string,
    options: {
      kind: StageRequestKind;
      status?: number | null;
      code?: ApiErrorCode | null;
      cause?: unknown;
    },
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "StageRequestError";
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.code = options.code ?? null;
  }
}

/** Message to show, and whether the detail page should reload the finding. */
export function stageRequestFailure(error: unknown): {
  message: string;
  refresh: boolean;
} {
  if (error instanceof StageRequestError) {
    return {
      message: error.message,
      refresh: error.status === 409 || error.code === "conflict",
    };
  }

  return { message: GENERIC_STAGE_ERROR, refresh: false };
}

function messageFor(
  status: number,
  code: ApiErrorCode | null,
  apiMessage: string | null,
): string {
  if (status === 404) {
    return NOT_FOUND_MESSAGE;
  }

  if (status === 409) {
    return CONFLICT_MESSAGE;
  }

  if (status === 422) {
    return apiMessage || GENERIC_STAGE_ERROR;
  }

  if (status === 400 || status === 500) {
    return GENERIC_STAGE_ERROR;
  }

  if (code === "not_found") {
    return NOT_FOUND_MESSAGE;
  }

  if (code === "conflict") {
    return CONFLICT_MESSAGE;
  }

  if (code === "invalid_transition" && apiMessage) {
    return apiMessage;
  }

  return GENERIC_STAGE_ERROR;
}

function readErrorBody(payload: unknown): {
  code: ApiErrorCode | null;
  message: string | null;
} {
  const parsed = apiErrorSchema.safeParse(payload);
  if (parsed.success) {
    return {
      code: parsed.data.error.code,
      message: parsed.data.error.message,
    };
  }

  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return { code: null, message: null };
  }

  const error = payload.error;
  if (!error || typeof error !== "object" || !("message" in error)) {
    return { code: null, message: null };
  }

  const message = error.message;
  if (typeof message !== "string" || message.length === 0) {
    return { code: null, message: null };
  }

  return { code: null, message };
}

function httpFailure(
  status: number,
  code: ApiErrorCode | null = null,
  apiMessage: string | null = null,
): StageRequestError {
  return new StageRequestError(messageFor(status, code, apiMessage), {
    kind: "http",
    status,
    code,
  });
}

async function errorFromResponse(
  response: Response,
): Promise<StageRequestError> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return httpFailure(response.status);
  }

  const body = readErrorBody(payload);
  return httpFailure(response.status, body.code, body.message);
}

function demoMoved(
  findingId: string,
  toStage: FindingStage,
): AdvanceFindingStageResult {
  return advanceFindingStageResultSchema.parse({
    id: findingId,
    stage: toStage,
    transitionedAt: new Date().toISOString(),
  });
}

/**
 * POST /api/findings/[id]/stage with `{ toStage }` and `x-org-id`.
 * Demo mode returns a local 200 body and does not call `fetch`.
 */
export async function advanceFindingStage(
  findingId: string,
  toStage: FindingStage,
): Promise<AdvanceFindingStageResult> {
  if (isDemoData()) {
    return demoMoved(findingId, toStage);
  }

  let response: Response;
  try {
    response = await fetch(`/api/findings/${findingId}/stage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [ORG_ID_HEADER]: orgId(),
      },
      body: JSON.stringify({ toStage }),
    });
  } catch (cause) {
    throw new StageRequestError("Could not reach findings.", {
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
    throw new StageRequestError("Findings returned an unexpected response.", {
      kind: "parse",
      status: response.status,
      cause,
    });
  }

  const parsed = advanceFindingStageResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new StageRequestError("Findings returned an unexpected response.", {
      kind: "parse",
      status: response.status,
      cause: parsed.error,
    });
  }

  return parsed.data;
}

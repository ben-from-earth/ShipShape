import { ORG_ID_HEADER, orgId } from "@/config/org";
import {
  apiErrorSchema,
  engineerSchema,
  signInBodySchema,
  type Engineer,
  type SignInBody,
} from "@/schemas";

const INCORRECT = "Email or password is incorrect.";
const ORG_ERROR = "Organization error.";

/** A failed auth request. `status` is null when the network failed. */
export class AuthApiError extends Error {
  readonly status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

export async function signIn(body: SignInBody): Promise<Engineer> {
  const parsed = signInBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AuthApiError(422, "Enter a valid email and password.");
  }
  const response = await send("/api/auth/sign-in", {
    method: "POST",
    json: parsed.data,
  });
  return readEngineer(response, "Could not sign in.");
}

export async function fetchCurrentEngineer(): Promise<Engineer> {
  const response = await send("/api/auth/me", { method: "GET" });
  return readEngineer(response, "Could not load the signed-in engineer.");
}

export async function signOut(): Promise<void> {
  const response = await send("/api/auth/sign-out", { method: "POST" });
  if (!response.ok) {
    throw new AuthApiError(
      response.status,
      (await failureMessage(response)) ?? "Could not sign out.",
    );
  }
}

async function send(
  path: string,
  options: { method: "GET" | "POST"; json?: unknown },
): Promise<Response> {
  try {
    return await fetch(path, {
      method: options.method,
      credentials: "same-origin",
      headers: {
        [ORG_ID_HEADER]: orgId(),
        ...(options.json !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        options.json === undefined ? undefined : JSON.stringify(options.json),
    });
  } catch {
    throw new AuthApiError(null, "Could not reach the server.");
  }
}

async function readEngineer(
  response: Response,
  fallback: string,
): Promise<Engineer> {
  if (!response.ok) {
    throw new AuthApiError(
      response.status,
      (await failureMessage(response)) ??
        (response.status === 401 ? INCORRECT : fallback),
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AuthApiError(response.status, fallback);
  }

  const parsed = engineerSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AuthApiError(response.status, fallback);
  }
  return parsed.data;
}

async function failureMessage(response: Response): Promise<string | null> {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    if (!parsed.success) {
      return null;
    }
    const paths = parsed.data.error.details?.map((detail) => detail.path) ?? [];
    if (
      parsed.data.error.code === "invalid_org_id" ||
      parsed.data.error.code === "unknown_organization" ||
      paths.includes(ORG_ID_HEADER)
    ) {
      return ORG_ERROR;
    }
    if (response.status === 401) {
      return parsed.data.error.message;
    }
  } catch {
    return null;
  }
  return null;
}

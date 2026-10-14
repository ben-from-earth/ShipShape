import "server-only";

import type { EngineeringDb } from "@/db/engineering";
import type { Engineer } from "@/schemas";
import { AnalysisRequestError } from "@/server/analyses/errors";

import { hashSessionToken, newSessionToken, sessionExpiresAt } from "./cookie";
import { hashPassword, verifyPassword } from "./password";
import { findEngineerCredentials, insertSession } from "./store";

export const INVALID_CREDENTIALS_MESSAGE = "Email or password is incorrect.";

let dummyPasswordHash: Promise<string> | undefined;

export async function signInEngineer(
  db: EngineeringDb,
  input: { email: string; password: string },
): Promise<{ engineer: Engineer; token: string; expiresAt: Date }> {
  const account = await findEngineerCredentials(db, input.email);
  const stored = account?.passwordHash ?? (await placeholderHash());
  const matches = await verifyPassword(input.password, stored);
  if (!account?.passwordHash || !matches) {
    throw new AnalysisRequestError(
      "unauthenticated",
      INVALID_CREDENTIALS_MESSAGE,
    );
  }

  const token = newSessionToken();
  const expiresAt = sessionExpiresAt();
  await insertSession(db, {
    engineerId: account.engineer.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });
  return { engineer: account.engineer, token, expiresAt };
}

function placeholderHash(): Promise<string> {
  dummyPasswordHash ??= hashPassword("placeholder-password");
  return dummyPasswordHash;
}

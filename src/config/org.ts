/** Header both document routes require. Matches the server's `ORG_ID_HEADER`. */
export const ORG_ID_HEADER = "x-org-id";

/**
 * Demo-seed organization (`demoIds.organization` in `src/db/demo-seed.ts`).
 * Duplicated here so a client component does not import the database module.
 */
export const DEMO_ORGANIZATION_ID = "10000000-0000-4000-8000-000000000001";

/**
 * Organization sent as `x-org-id`.
 * `NEXT_PUBLIC_ORG_ID` overrides the demo-seed organization.
 * TODO(#13): take this from the session once auth exists.
 */
export function orgId(): string {
  const configured = process.env.NEXT_PUBLIC_ORG_ID?.trim();
  if (configured) {
    return configured;
  }

  return DEMO_ORGANIZATION_ID;
}

/** Document routes use the same organization as every other request. */
export function documentOrgId(): string {
  return orgId();
}

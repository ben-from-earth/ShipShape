/**
 * Who is recorded on `stage_transitions.changed_by`.
 *
 * POST /api/findings stores `uploadedBy` as null until requests carry a
 * session (#13). This is the same stand-in. The stage route checks the
 * value is a UUID and returns `validation_error` when it is not, so
 * `advanceStage` is only called with a UUID. A UUID that is not a user
 * is a foreign-key error from that write.
 */
export function temporaryActorId(): string | null {
  return null;
}

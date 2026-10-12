/**
 * Who is recorded on `stage_transitions.changed_by`.
 *
 * POST /api/findings stores `uploadedBy` as null until requests carry a
 * session (#13). This is the same stand-in. Null is passed to
 * `advanceStage` and written as NULL. A value that is neither null nor a
 * UUID is `validation_error` and is not passed in. A UUID that is not a
 * user is a foreign-key error from that write.
 */
export function temporaryActorId(): string | null {
  return null;
}

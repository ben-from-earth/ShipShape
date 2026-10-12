/**
 * Fallback low-margin threshold (0.10).
 *
 * `getLowMarginThreshold()` prefers `organizations.low_margin_threshold`
 * and uses this value when the organization row is missing or the
 * database is not configured. Negative margins are always red.
 */
export const LOW_MARGIN_THRESHOLD = 0.1;

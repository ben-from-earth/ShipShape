/**
 * Fallback low-margin threshold (0.10).
 *
 * This stands in for a future per-organization setting,
 * `organizations.low_margin_threshold`. Pass that value into the margin
 * classifier when an organization has one. Negative margins are always
 * red, whatever cutoff is in effect.
 */
export const LOW_MARGIN_THRESHOLD = 0.1;

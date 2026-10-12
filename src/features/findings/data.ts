import "server-only";

/**
 * Page entry for findings. This is the one import that chooses the
 * database readers. Point it at `./demo` to render the typed fixture.
 */
export { getFinding, getFindingMedia, listFindings } from "./db";

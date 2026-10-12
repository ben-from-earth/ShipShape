/**
 * Shared request and record schemas. UI and server code both import from
 * here so a form and its route handler validate the same payload.
 */

export {
  idSchema,
  longTextSchema,
  shortTextSchema,
  timestampSchema,
} from "./common";

export {
  damagePhotoCreateSchema,
  damagePhotoSchema,
  damageReportCreateSchema,
  damageReportSchema,
  damageReportStatusSchema,
} from "./damage-report";
export type {
  DamagePhoto,
  DamagePhotoCreate,
  DamageReport,
  DamageReportCreate,
  DamageReportStatus,
} from "./damage-report";

export { repairCreateSchema, repairSchema, repairStatusSchema } from "./repair";
export type { Repair, RepairCreate, RepairStatus } from "./repair";

export {
  analysisConclusionSchema,
  analysisCreateSchema,
  analysisSchema,
} from "./analysis";
export type { Analysis, AnalysisConclusion, AnalysisCreate } from "./analysis";

export {
  reviewCreateSchema,
  reviewDecisionSchema,
  reviewSchema,
} from "./review";
export type { Review, ReviewCreate, ReviewDecision } from "./review";

export {
  DOCUMENT_EMBEDDING_DIMENSIONS,
  DOCUMENT_EMBEDDING_MODEL,
  documentCreateSchema,
  documentSchema,
  documentUploadResultSchema,
} from "./document";
export type {
  Document,
  DocumentCreate,
  DocumentUploadResult,
} from "./document";

export {
  apiErrorCodeSchema,
  apiErrorDetailSchema,
  apiErrorSchema,
} from "./api-error";
export type { ApiError, ApiErrorCode, ApiErrorDetail } from "./api-error";

export {
  documentChunkSchema,
  documentEmbeddingSchema,
  documentSearchHitSchema,
  documentSearchQuerySchema,
  documentSearchResultSchema,
} from "./documents";
export type {
  DocumentChunk,
  DocumentEmbedding,
  DocumentSearchHit,
  DocumentSearchQuery,
  DocumentSearchResult,
} from "./documents";

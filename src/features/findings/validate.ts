import {
  MAX_FINDING_PHOTO_BYTES,
  MAX_FINDING_PHOTOS,
  MIN_FINDING_PHOTOS,
  canonicalFindingPhotoMediaType,
  findingPhotoFileExtension,
  findingPhotoMediaTypeForExtension,
} from "@/config/findings";
import { SEVERITIES, type Severity } from "@/config/severity";
import { createFindingFieldsSchema, type CreateFindingFields } from "@/schemas";

export type FindingPhotoInput = {
  name: string;
  type: string;
  size: number;
};

export type FindingDraft = {
  assetId: string;
  description: string;
  severity: string;
  zone: string;
  locationLabel: string;
  photos: readonly FindingPhotoInput[];
};

export type FindingField = keyof Omit<FindingDraft, "photos"> | "photos";

export function findingErrors(
  draft: FindingDraft,
): Partial<Record<FindingField, string>> {
  const errors: Partial<Record<FindingField, string>> = {};
  const parsed = createFindingFieldsSchema.safeParse({
    assetId: draft.assetId,
    description: draft.description,
    severity: draft.severity,
    zone: draft.zone,
    locationLabel: draft.locationLabel,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "assetId" && !errors.assetId) {
        errors.assetId = "Choose an asset.";
      } else if (key === "description" && !errors.description) {
        errors.description = "Describe the finding.";
      } else if (key === "severity" && !errors.severity) {
        errors.severity = "Choose a severity.";
      }
    }
  }

  const photoError = photoProblem(draft.photos);
  if (photoError) {
    errors.photos = photoError;
  }

  return errors;
}

export function photoProblem(
  photos: readonly FindingPhotoInput[],
): string | null {
  if (photos.length < MIN_FINDING_PHOTOS) {
    return "Add a photo.";
  }

  if (photos.length > MAX_FINDING_PHOTOS) {
    return `Add up to ${MAX_FINDING_PHOTOS} photos.`;
  }

  for (const photo of photos) {
    if (photo.size <= 0) {
      return "Photo is empty.";
    }
    if (photo.size > MAX_FINDING_PHOTO_BYTES) {
      return "Photo too large.";
    }
    const stored = canonicalFindingPhotoMediaType(photo.type);
    const fromName = findingPhotoMediaTypeForExtension(
      findingPhotoFileExtension(photo.name),
    );
    if (!stored || stored !== fromName) {
      return "Photo type not supported.";
    }
  }

  return null;
}

export function isFindingSeverity(value: string): value is Severity {
  return SEVERITIES.some((severity) => severity === value);
}

export function toFindingForm(draft: FindingDraft): CreateFindingFields {
  return createFindingFieldsSchema.parse({
    assetId: draft.assetId,
    description: draft.description,
    severity: draft.severity,
    zone: draft.zone,
    locationLabel: draft.locationLabel,
  });
}

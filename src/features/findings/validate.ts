import {
  FINDING_PHOTO_MEDIA_TYPES,
  SEVERITIES,
  MAX_FINDING_PHOTO_BYTES,
  MAX_FINDING_PHOTOS,
  findingFormSchema,
  type FindingForm,
  type FindingSeverity,
} from "./contract";

export type FindingPhotoInput = {
  name: string;
  type: string;
  size: number;
};

export type FindingDraft = {
  assetId: string;
  title: string;
  description: string;
  severity: string;
  zone: string;
  locationLabel: string;
  photos: readonly FindingPhotoInput[];
};

export type FindingField =
  keyof Omit<FindingDraft, "photos"> | "photos" | "place";

const PHOTO_TYPES = new Set<string>(FINDING_PHOTO_MEDIA_TYPES);

export function findingErrors(
  draft: FindingDraft,
): Partial<Record<FindingField, string>> {
  const errors: Partial<Record<FindingField, string>> = {};
  const parsed = findingFormSchema.safeParse({
    assetId: draft.assetId,
    title: draft.title,
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
      } else if (key === "title" && !errors.title) {
        errors.title = "Enter a title.";
      } else if (key === "description" && !errors.description) {
        errors.description = "Describe the finding.";
      } else if (key === "severity" && !errors.severity) {
        errors.severity = "Choose a severity.";
      }
    }
  }

  const zone = draft.zone.trim();
  const location = draft.locationLabel.trim();
  if (!zone && !location) {
    errors.place = "Enter a location or a zone.";
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
  if (photos.length > MAX_FINDING_PHOTOS) {
    return `Add up to ${MAX_FINDING_PHOTOS} photos.`;
  }

  for (const photo of photos) {
    const type = photo.type.trim().toLowerCase();
    if (!PHOTO_TYPES.has(type)) {
      return "Photo type not supported.";
    }
    if (photo.size > MAX_FINDING_PHOTO_BYTES) {
      return "Photo too large.";
    }
  }

  return null;
}

export function isFindingSeverity(value: string): value is FindingSeverity {
  return SEVERITIES.some((severity) => severity === value);
}

export function toFindingForm(draft: FindingDraft): FindingForm {
  return findingFormSchema.parse({
    assetId: draft.assetId,
    title: draft.title,
    description: draft.description,
    severity: draft.severity,
    zone: draft.zone,
    locationLabel: draft.locationLabel,
  });
}

"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SEVERITIES, type Severity } from "@/config/severity";
import { createFinding, FindingRequestError } from "@/features/findings/client";
import {
  FINDING_PHOTO_MEDIA_TYPES,
  MAX_FINDING_PHOTOS,
  type FindingCreated,
} from "@/features/findings/contract";
import {
  FINDING_ASSETS,
  FINDING_ASSET_GROUPS,
  type FindingAsset,
} from "@/features/findings/fixtures";
import { fieldLabels } from "@/features/findings/labels";
import {
  findingErrors,
  type FindingDraft,
  type FindingField,
} from "@/features/findings/validate";
import { cn } from "@/lib/utils";

type Preview = {
  key: string;
  file: File;
  url: string;
};

const ACCEPT = FINDING_PHOTO_MEDIA_TYPES.join(",");

const inputClass =
  "w-full border border-line-strong bg-surface px-3 py-3 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function NewFindingForm() {
  const [groupId, setGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [zone, setZone] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [photos, setPhotos] = useState<Preview[]>([]);
  const [errors, setErrors] = useState<Partial<Record<FindingField, string>>>(
    {},
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<FindingCreated | null>(null);
  const photosRef = useRef(photos);

  const group = FINDING_ASSET_GROUPS.find((item) => item.id === groupId);
  const labels = fieldLabels(group?.assetType);
  const assets = useMemo(() => {
    const terms = query.trim().toLowerCase();
    return FINDING_ASSETS.filter((asset) => {
      if (asset.groupId !== groupId) {
        return false;
      }
      if (!terms) {
        return true;
      }
      return (
        asset.identifier.toLowerCase().includes(terms) ||
        asset.name.toLowerCase().includes(terms)
      );
    });
  }, [groupId, query]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.url);
      }
    };
  }, []);

  function draft(): FindingDraft {
    return {
      assetId,
      title,
      description,
      severity,
      zone,
      locationLabel,
      photos: photos.map((photo) => ({
        name: photo.file.name,
        type: photo.file.type,
        size: photo.file.size,
      })),
    };
  }

  function addPhotos(list: FileList | File[]) {
    const incoming = Array.from(list);
    if (incoming.length === 0) {
      return;
    }
    setCreated(null);
    setSubmitError(null);
    setPhotos((current) => {
      const next = [...current];
      for (const file of incoming) {
        if (next.length >= MAX_FINDING_PHOTOS) {
          break;
        }
        next.push({
          key: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
        });
      }
      return next;
    });
  }

  function removePhoto(key: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.key === key);
      if (photo) {
        URL.revokeObjectURL(photo.url);
      }
      return current.filter((item) => item.key !== key);
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = findingErrors(draft());
    setErrors(next);
    setSubmitError(null);
    setCreated(null);
    if (Object.keys(next).length > 0) {
      return;
    }

    setPending(true);
    try {
      const result = await createFinding(
        draft(),
        photos.map((photo) => photo.file),
      );
      setCreated(result);
    } catch (caught) {
      setSubmitError(visibleError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex max-w-3xl flex-col gap-6"
      noValidate
    >
      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <Eyebrow>Asset</Eyebrow>
        <Field label="Asset group" htmlFor="finding-group">
          <select
            id="finding-group"
            className={inputClass}
            value={groupId}
            onChange={(event) => {
              setGroupId(event.target.value);
              setAssetId("");
              setQuery("");
            }}
          >
            <option value="">Choose an asset group</option>
            {FINDING_ASSET_GROUPS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={`Search by ${labels.identifier.toLowerCase()}`}
          htmlFor="finding-asset-search"
        >
          <input
            id="finding-asset-search"
            className={inputClass}
            value={query}
            disabled={!groupId}
            placeholder={
              groupId ? labels.identifier : "Choose an asset group first"
            }
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-ui font-medium">{labels.identifier}</span>
          {groupId ? (
            <ul
              className="flex flex-col border border-line bg-surface"
              aria-label="Assets"
            >
              {assets.length === 0 ? (
                <li className="px-3 py-3 text-body text-ink-muted">
                  No assets match.
                </li>
              ) : (
                assets.map((asset) => (
                  <li
                    key={asset.id}
                    className="border-b border-line-faint last:border-b-0"
                  >
                    <AssetChoice
                      asset={asset}
                      selected={asset.id === assetId}
                      onSelect={() => {
                        setAssetId(asset.id);
                      }}
                    />
                  </li>
                ))
              )}
            </ul>
          ) : (
            <p className="text-body text-ink-muted">
              Choose an asset group first.
            </p>
          )}
          <FieldError message={errors.assetId} />
        </div>
      </Card>

      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <Eyebrow>Finding</Eyebrow>
        <Field label="Title" htmlFor="finding-title" error={errors.title}>
          <input
            id="finding-title"
            className={inputClass}
            value={title}
            maxLength={200}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="finding-description"
          error={errors.description}
        >
          <textarea
            id="finding-description"
            className={cn(inputClass, "min-h-28 resize-y")}
            value={description}
            maxLength={5000}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-ui font-medium">Severity</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SEVERITIES.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={severity === level}
                className={cn(
                  "min-h-11 border px-3 py-2 text-ui capitalize",
                  severity === level
                    ? "border-ink bg-ink text-white"
                    : "border-line-strong bg-surface text-ink",
                )}
                onClick={() => {
                  setSeverity(level);
                }}
              >
                {level}
              </button>
            ))}
          </div>
          <FieldError message={errors.severity} />
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.location} htmlFor="finding-location">
            <input
              id="finding-location"
              className={inputClass}
              value={locationLabel}
              maxLength={200}
              onChange={(event) => {
                setLocationLabel(event.target.value);
              }}
            />
          </Field>
          <Field label="Zone" htmlFor="finding-zone">
            <input
              id="finding-zone"
              className={inputClass}
              value={zone}
              maxLength={200}
              onChange={(event) => {
                setZone(event.target.value);
              }}
            />
          </Field>
        </div>
        <FieldError message={errors.place} />
      </Card>

      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <Eyebrow>Photos</Eyebrow>
        <p className="text-body text-ink-muted">
          Up to {MAX_FINDING_PHOTOS} photos. Use the camera or choose files.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center border border-ink bg-ink px-4 text-ui font-medium text-white">
            Take photo
            <input
              type="file"
              accept={ACCEPT}
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                if (event.target.files) {
                  addPhotos(event.target.files);
                }
                event.target.value = "";
              }}
            />
          </label>
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center border border-line-strong bg-surface px-4 text-ui font-medium">
            Choose files
            <input
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              onChange={(event) => {
                if (event.target.files) {
                  addPhotos(event.target.files);
                }
                event.target.value = "";
              }}
            />
          </label>
        </div>
        {photos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <li
                key={photo.key}
                className="flex flex-col gap-2 border border-line bg-surface p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.file.name}
                  className="aspect-square w-full object-cover"
                />
                <button
                  type="button"
                  className="min-h-11 text-ui text-accent"
                  onClick={() => {
                    removePhoto(photo.key);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <FieldError message={errors.photos} />
      </Card>

      {submitError ? (
        <p className="text-body text-accent" role="alert">
          {submitError}
        </p>
      ) : null}
      {created ? (
        <p className="text-body text-ink" role="status">
          Recorded {created.code} at stage {created.stage}.
        </p>
      ) : null}
      <Button
        type="submit"
        className="min-h-11 w-full sm:w-auto"
        disabled={pending}
      >
        {pending ? "Saving" : "Save finding"}
      </Button>
    </form>
  );
}

function AssetChoice({
  asset,
  selected,
  onSelect,
}: {
  asset: FindingAsset;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "flex min-h-11 w-full flex-col items-start gap-0.5 px-3 py-3 text-left",
        selected ? "bg-ink text-white" : "hover:bg-sunken",
      )}
      onClick={onSelect}
    >
      <span className="text-ui font-medium">{asset.identifier}</span>
      <span
        className={cn("text-body", selected ? "text-white" : "text-ink-muted")}
      >
        {asset.name}
      </span>
    </button>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-2">
      <span className="text-ui font-medium">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p className="text-body text-accent" role="alert">
      {message}
    </p>
  );
}

function visibleError(caught: unknown): string {
  if (caught instanceof FindingRequestError) {
    return caught.message;
  }
  if (caught instanceof Error && caught.message.length > 0) {
    return caught.message;
  }
  return "Finding failed.";
}

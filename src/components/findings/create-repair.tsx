"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  REPAIR_STATUS_LABEL,
  REPAIR_STATUS_OPTIONS,
} from "@/features/repairs/display";
import {
  createRepair,
  repairRequestProblems,
  RepairRequestError,
} from "@/features/repairs/client";
import {
  repairFormErrors,
  type RepairDraft,
  type RepairFormField,
} from "@/features/repairs/form";

const inputClass =
  "min-h-11 w-full border border-line-strong bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const emptyDraft: RepairDraft = { title: "", type: "", status: "" };

export function CreateRepair({ findingId }: { findingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RepairDraft>(emptyDraft);
  const [errors, setErrors] = useState<
    Partial<Record<RepairFormField, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(field: RepairFormField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    const problems = repairFormErrors(draft);
    setErrors(problems);
    setFormError(null);
    if (Object.keys(problems).length > 0) {
      return;
    }

    setPending(true);
    try {
      const result = await createRepair(findingId, draft);
      router.push(`/repairs/${result.id}`);
    } catch (caught) {
      if (caught instanceof RepairRequestError) {
        const failure = repairRequestProblems(caught);
        setErrors(failure.fields);
        setFormError(failure.form);
      } else {
        setFormError("Could not create the repair.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-card-title font-semibold">Repairs</h2>
        {open ? null : (
          <Button
            type="button"
            variant="dark"
            size="sm"
            onClick={() => {
              setOpen(true);
            }}
          >
            Create repair
          </Button>
        )}
      </div>
      {open ? (
        <form
          className="flex flex-col gap-4 border border-line bg-surface p-4"
          onSubmit={(event) => {
            void onSubmit(event);
          }}
        >
          <Field label="Title" htmlFor="repair-title" error={errors.title}>
            <input
              id="repair-title"
              name="title"
              value={draft.title}
              className={inputClass}
              onChange={(event) => {
                update("title", event.target.value);
              }}
            />
          </Field>
          <Field label="Type" htmlFor="repair-type" error={errors.type}>
            <input
              id="repair-type"
              name="type"
              value={draft.type}
              placeholder="Optional"
              className={inputClass}
              onChange={(event) => {
                update("type", event.target.value);
              }}
            />
          </Field>
          <Field label="Status" htmlFor="repair-status" error={errors.status}>
            <select
              id="repair-status"
              name="status"
              value={draft.status}
              className={inputClass}
              onChange={(event) => {
                update("status", event.target.value);
              }}
            >
              <option value="">Optional</option>
              {REPAIR_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {REPAIR_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </Field>
          {formError ? (
            <p className="text-body text-accent" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="dark"
              className="min-h-11"
              disabled={pending}
            >
              {pending ? "Creating" : "Create repair"}
            </Button>
            <Button
              type="button"
              variant="subtle"
              className="min-h-11"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setDraft(emptyDraft);
                setErrors({});
                setFormError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
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
      {error ? (
        <p className="text-body text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </label>
  );
}

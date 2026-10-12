"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { MarginValue } from "@/components/ui/margin-value";
import {
  AnalysisRequestError,
  analysisRequestProblems,
  createAnalysis,
} from "@/features/analyses/client";
import {
  ANALYSIS_STATUS_LABEL,
  ANALYSIS_STATUS_OPTIONS,
  analysisFormErrors,
  parseAnalysisMargin,
  type AnalysisDraft,
  type AnalysisFormField,
} from "@/features/analyses/form";

const inputClass =
  "min-h-11 w-full border border-line-strong bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const emptyDraft: AnalysisDraft = {
  title: "",
  method: "",
  loadCase: "",
  margin: "",
  status: "",
  dueDate: "",
  revision: "",
};

/**
 * Create analysis on a repair. Posts to `/api/repairs/[id]/analyses`.
 * The body uses the local stand-in until `analysisCreateBodySchema` is exported from `@/schemas`.
 */
export function CreateAnalysis({
  repairId,
  marginThreshold,
}: {
  repairId: string;
  /** Organization cutoff passed in from the server page. */
  marginThreshold: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AnalysisDraft>(emptyDraft);
  const [errors, setErrors] = useState<
    Partial<Record<AnalysisFormField, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(field: AnalysisFormField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    const problems = analysisFormErrors(draft);
    setErrors(problems);
    setFormError(null);
    if (Object.keys(problems).length > 0) {
      return;
    }

    setPending(true);
    try {
      const result = await createAnalysis(repairId, draft);
      router.push(`/analyses/${result.id}`);
    } catch (caught) {
      if (caught instanceof AnalysisRequestError) {
        const failure = analysisRequestProblems(caught);
        setErrors(failure.fields);
        setFormError(failure.form);
      } else {
        setFormError("Could not create the analysis.");
      }
    } finally {
      setPending(false);
    }
  }

  const preview = parseAnalysisMargin(draft.margin);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-card-title font-semibold">Analysis</h2>
        {open ? null : (
          <Button
            type="button"
            variant="dark"
            size="sm"
            onClick={() => {
              setOpen(true);
            }}
          >
            Create analysis
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
          <Field label="Title" htmlFor="analysis-title" error={errors.title}>
            <input
              id="analysis-title"
              name="title"
              value={draft.title}
              className={inputClass}
              onChange={(event) => {
                update("title", event.target.value);
              }}
            />
          </Field>
          <Field label="Method" htmlFor="analysis-method" error={errors.method}>
            <input
              id="analysis-method"
              name="method"
              value={draft.method}
              placeholder="Optional"
              className={inputClass}
              onChange={(event) => {
                update("method", event.target.value);
              }}
            />
          </Field>
          <Field
            label="Load case"
            htmlFor="analysis-load-case"
            error={errors.loadCase}
          >
            <input
              id="analysis-load-case"
              name="loadCase"
              value={draft.loadCase}
              placeholder="Optional"
              className={inputClass}
              onChange={(event) => {
                update("loadCase", event.target.value);
              }}
            />
          </Field>
          <Field label="Margin" htmlFor="analysis-margin" error={errors.margin}>
            <input
              id="analysis-margin"
              name="margin"
              inputMode="decimal"
              value={draft.margin}
              placeholder="0.10"
              className={inputClass}
              onChange={(event) => {
                update("margin", event.target.value);
              }}
            />
            {preview != null ? (
              <MarginValue margin={preview} threshold={marginThreshold} />
            ) : null}
          </Field>
          <Field label="Status" htmlFor="analysis-status" error={errors.status}>
            <select
              id="analysis-status"
              name="status"
              value={draft.status}
              className={inputClass}
              onChange={(event) => {
                update("status", event.target.value);
              }}
            >
              <option value="">Optional</option>
              {ANALYSIS_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {ANALYSIS_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Due date"
            htmlFor="analysis-due-date"
            error={errors.dueDate}
          >
            <input
              id="analysis-due-date"
              name="dueDate"
              value={draft.dueDate}
              placeholder="YYYY-MM-DD"
              className={inputClass}
              onChange={(event) => {
                update("dueDate", event.target.value);
              }}
            />
          </Field>
          <Field
            label="Revision"
            htmlFor="analysis-revision"
            error={errors.revision}
          >
            <input
              id="analysis-revision"
              name="revision"
              value={draft.revision}
              placeholder="Optional"
              className={inputClass}
              onChange={(event) => {
                update("revision", event.target.value);
              }}
            />
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
              {pending ? "Creating" : "Create analysis"}
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

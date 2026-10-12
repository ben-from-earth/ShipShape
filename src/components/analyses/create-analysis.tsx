"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { MarginValue } from "@/components/ui/margin-value";
import {
  analysisFormErrors,
  parseAnalysisMargin,
  toAnalysisFields,
  type AnalysisDraft,
  type AnalysisFormField,
} from "@/features/analyses/form";
import {
  ANALYSIS_PAGE_STATUS_LABEL,
  ANALYSIS_PAGE_STATUSES,
} from "@/features/analyses/view";

const inputClass =
  "min-h-11 w-full border border-line-strong bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const emptyDraft: AnalysisDraft = {
  title: "",
  method: "",
  loadCase: "",
  margin: "",
  status: "",
  revision: "",
};

/**
 * Create analysis on a repair. Submit checks the draft and does not
 * call an endpoint. The POST route lands after #33.
 */
export function CreateAnalysis({
  repairId,
  marginThreshold,
}: {
  repairId: string;
  /** Organization cutoff passed in from the server page. */
  marginThreshold: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AnalysisDraft>(emptyDraft);
  const [errors, setErrors] = useState<
    Partial<Record<AnalysisFormField, string>>
  >({});
  const [notice, setNotice] = useState<string | null>(null);

  function update(field: AnalysisFormField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problems = analysisFormErrors(draft);
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      setNotice(null);
      return;
    }

    void toAnalysisFields(draft);
    setNotice("This analysis is not saved yet.");
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
          onSubmit={onSubmit}
        >
          <input type="hidden" name="repairId" value={repairId} />
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
              {ANALYSIS_PAGE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ANALYSIS_PAGE_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
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
          {notice ? (
            <p className="text-body text-ink-muted" role="status">
              {notice}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="dark" className="min-h-11">
              Create analysis
            </Button>
            <Button
              type="button"
              variant="subtle"
              className="min-h-11"
              onClick={() => {
                setOpen(false);
                setDraft(emptyDraft);
                setErrors({});
                setNotice(null);
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

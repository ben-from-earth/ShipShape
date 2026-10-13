"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import {
  createReview,
  createReviewProblems,
  ReviewRequestError,
  submitForReview,
  submitRequestProblems,
} from "@/features/analyses/review-client";
import {
  REVIEW_DECISION_LABEL,
  REVIEW_DECISION_OPTIONS,
  reviewFormErrors,
  showReviewForm,
  showSubmitForReview,
  type ReviewDraft,
  type ReviewFormField,
} from "@/features/analyses/review-form";
import {
  REVIEW_HISTORY_LABEL,
  REVIEW_HISTORY_TONE,
  type ReviewHistory,
} from "@/features/analyses/review-history";
import { formatFindingDate } from "@/features/findings/display";
import type { AnalysisDbStatus } from "@/schemas";

const inputClass =
  "min-h-11 w-full border border-line-strong bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const emptyDraft: ReviewDraft = {
  decision: "",
  comment: "",
};

/**
 * Submit an analysis for review, or record a decision while it is in review.
 * History lists reviews already stored for this analysis.
 */
export function ReviewPanel({
  analysisId,
  status,
  reviews,
}: {
  analysisId: string;
  status: AnalysisDbStatus;
  reviews: readonly ReviewHistory[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft);
  const [errors, setErrors] = useState<
    Partial<Record<ReviewFormField, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = showSubmitForReview(status);
  const canReview = showReviewForm(status);

  async function onSubmitForReview() {
    if (pending) {
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      await submitForReview(analysisId);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ReviewRequestError) {
        const failure = submitRequestProblems(caught);
        setFormError(failure.message);
        if (failure.refresh) {
          router.refresh();
        }
      } else {
        setFormError("Could not submit the analysis.");
      }
    } finally {
      setPending(false);
    }
  }

  async function onSubmitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    const problems = reviewFormErrors(draft);
    setErrors(problems);
    setFormError(null);
    if (Object.keys(problems).length > 0) {
      return;
    }

    setPending(true);
    try {
      await createReview(analysisId, draft);
      setDraft(emptyDraft);
      setErrors({});
      router.refresh();
    } catch (caught) {
      if (caught instanceof ReviewRequestError) {
        const failure = createReviewProblems(caught);
        setErrors(failure.fields);
        setFormError(failure.message);
        if (failure.refresh) {
          router.refresh();
        }
      } else {
        setFormError("Could not save the review.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-card-title font-semibold">Review</h2>
      {canSubmit ? (
        <div className="flex flex-col items-start gap-3">
          <Button
            type="button"
            variant="dark"
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              void onSubmitForReview();
            }}
          >
            {pending ? "Submitting" : "Submit for review"}
          </Button>
        </div>
      ) : null}
      {canReview ? (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void onSubmitReview(event);
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="text-ui font-medium">Decision</legend>
            {REVIEW_DECISION_OPTIONS.map((decision) => (
              <label
                key={decision}
                className="flex min-h-11 items-center gap-3 text-body"
              >
                <input
                  type="radio"
                  name="decision"
                  value={decision}
                  checked={draft.decision === decision}
                  onChange={() => {
                    setDraft((current) => ({ ...current, decision }));
                  }}
                />
                {REVIEW_DECISION_LABEL[decision]}
              </label>
            ))}
            {errors.decision ? (
              <p className="text-body text-accent" role="alert">
                {errors.decision}
              </p>
            ) : null}
          </fieldset>
          <label htmlFor="review-comment" className="flex flex-col gap-2">
            <span className="text-ui font-medium">Comment</span>
            <textarea
              id="review-comment"
              name="comment"
              required
              aria-required="true"
              rows={4}
              value={draft.comment}
              className={inputClass}
              onChange={(event) => {
                const comment = event.target.value;
                setDraft((current) => ({ ...current, comment }));
              }}
            />
            {errors.comment ? (
              <p className="text-body text-accent" role="alert">
                {errors.comment}
              </p>
            ) : null}
          </label>
          <Button
            type="submit"
            variant="dark"
            className="min-h-11 self-start"
            disabled={pending}
          >
            {pending ? "Saving" : "Save review"}
          </Button>
        </form>
      ) : null}
      {formError ? (
        <p className="text-body text-accent" role="alert">
          {formError}
        </p>
      ) : null}
      <ReviewHistoryList reviews={reviews} />
    </div>
  );
}

function ReviewHistoryList({ reviews }: { reviews: readonly ReviewHistory[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-ui font-medium text-ink-muted">History</h3>
      {reviews.length === 0 ? (
        <p className="text-body text-ink-muted">No reviews yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((review) => (
            <li key={review.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusPill
                  label={REVIEW_HISTORY_LABEL[review.decision]}
                  tone={REVIEW_HISTORY_TONE[review.decision]}
                />
                <time
                  dateTime={review.createdAt}
                  className="text-body text-ink-muted"
                >
                  {formatFindingDate(review.createdAt)}
                </time>
              </div>
              {review.comment ? (
                <p className="text-body text-pretty">{review.comment}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

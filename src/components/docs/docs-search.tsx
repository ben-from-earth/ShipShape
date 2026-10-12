"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { uploadDocument, searchDocuments } from "@/features/documents/client";
import {
  ACCEPTED_DOCUMENT_TYPES,
  formatPageRange,
  mediaTypeForFile,
  scorePercent,
} from "@/features/documents/derive";
import { SEARCH_EXAMPLES } from "@/features/documents/fixtures";
import type { Document, DocumentSearchResult } from "@/schemas";
import { cn } from "@/lib/utils";

type Phase = "idle" | "loading" | "done" | "error";

export function DocsSearch({ map }: { map: ReactNode }) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<DocumentSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Document[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function runSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();
    if (!trimmed) {
      return;
    }

    setQuery(trimmed);
    setPhase("loading");
    setError(null);

    try {
      const found = await searchDocuments({ query: trimmed });
      setResult(found);
      setPhase("done");
    } catch (caught) {
      setPhase("error");
      setError(caught instanceof Error ? caught.message : "Search failed");
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  async function takeFiles(files: FileList | File[]) {
    setUploadError(null);
    const accepted: Document[] = [];
    let rejected = 0;

    for (const file of files) {
      if (!mediaTypeForFile(file.name, file.type)) {
        rejected += 1;
        continue;
      }

      try {
        accepted.push(await uploadDocument(file));
      } catch (caught) {
        setUploadError(
          caught instanceof Error ? caught.message : "Upload failed",
        );
      }
    }

    if (accepted.length > 0) {
      setUploads((current) => [...accepted, ...current]);
    }

    if (rejected > 0) {
      setUploadError("Use a PDF, Word, plain text, or Markdown file.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-label="Intelli-Search">
        <div className="flex flex-wrap items-baseline gap-3">
          <Eyebrow>Intelli-Search</Eyebrow>
          <p className="font-mono text-caption text-ink-muted">
            Searches by meaning, not exact text
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="flex border-[1.5px] border-ink bg-surface"
        >
          <label htmlFor="docs-query" className="sr-only">
            Ask a question
          </label>
          <span className="flex items-center border-r border-line-soft px-4 font-mono text-body text-accent">
            Ask
          </span>
          <input
            id="docs-query"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Describe the damage, the location, or the task"
            className="min-w-0 flex-1 border-none bg-transparent px-4 py-4 text-title text-ink outline-none placeholder:text-ink-faint"
          />
          {query.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResult(null);
                setPhase("idle");
                setError(null);
              }}
              className="px-3.5 font-mono text-caption text-ink-muted hover:text-ink"
            >
              Clear
            </button>
          ) : null}
          <Button
            type="submit"
            className="px-[26px]"
            disabled={phase === "loading" || query.trim().length === 0}
          >
            Search
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">Try:</span>
          {SEARCH_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                void runSearch(example);
              }}
              className="border border-line bg-paper-raised px-[11px] py-1.5 text-[12.5px] text-ink-2 hover:border-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      <DropZone
        dragging={dragging}
        uploads={uploads}
        error={uploadError}
        onDragging={setDragging}
        onFiles={(files) => {
          void takeFiles(files);
        }}
      />

      {map}

      <div aria-live="polite">
        {phase === "loading" ? (
          <Card className="flex flex-col gap-3 bg-paper-raised px-[22px] py-[22px]">
            <Eyebrow>Searching</Eyebrow>
            <p className="text-lead">&ldquo;{query}&rdquo;</p>
          </Card>
        ) : null}
        {phase === "error" && error ? (
          <p className="text-body text-accent" role="alert">
            {error}
          </p>
        ) : null}
        {phase === "done" && result ? <SearchResults result={result} /> : null}
      </div>
    </div>
  );
}

function DropZone({
  dragging,
  uploads,
  error,
  onDragging,
  onFiles,
}: {
  dragging: boolean;
  uploads: readonly Document[];
  error: string | null;
  onDragging: (dragging: boolean) => void;
  onFiles: (files: FileList | File[]) => void;
}) {
  return (
    <section aria-label="Add a publication" className="flex flex-col gap-3">
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 border border-dashed border-line-strong bg-paper px-6 py-10 text-center",
          dragging && "border-ink bg-surface",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          onDragging(true);
        }}
        onDragLeave={() => {
          onDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDragging(false);
          onFiles(event.dataTransfer.files);
        }}
      >
        <span className="text-ui font-semibold">Drop a publication</span>
        <span className="max-w-measure text-body text-ink-muted">
          PDF, Word, plain text, or Markdown. The file is kept for this session.
        </span>
        <input
          type="file"
          className="sr-only"
          multiple
          accept={ACCEPTED_DOCUMENT_TYPES.join(",")}
          onChange={(event) => {
            if (event.target.files) {
              onFiles(event.target.files);
              event.target.value = "";
            }
          }}
        />
      </label>
      {error ? (
        <p className="text-body text-accent" role="alert">
          {error}
        </p>
      ) : null}
      {uploads.length > 0 ? (
        <ul className="flex flex-col border border-line bg-surface">
          {uploads.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-faint px-4 py-3 last:border-b-0"
            >
              <span className="font-medium">{document.title}</span>
              <span className="font-mono text-caption text-ink-muted">
                {document.mediaType}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SearchResults({ result }: { result: DocumentSearchResult }) {
  return (
    <section className="flex flex-col gap-4" aria-label="Search results">
      <h2 className="font-mono text-caption tracking-eyebrow text-ink-muted uppercase">
        Source passages · {result.hits.length}
      </h2>
      {result.hits.length === 0 ? (
        <Card className="bg-paper-raised px-[18px] py-[18px] text-ui text-ink-muted">
          No strong matches. Describe the symptom, the location, or the task.
        </Card>
      ) : (
        <ol className="flex flex-col gap-3">
          {result.hits.map((hit, index) => {
            const pages = formatPageRange(
              hit.chunk.pageStart,
              hit.chunk.pageEnd,
            );
            const percent = scorePercent(hit.score);

            return (
              <li key={`${hit.documentId}-${hit.chunk.index}`}>
                <article className="flex flex-col gap-2 border border-line bg-paper-raised px-[18px] py-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="bg-navy px-1.5 py-0.5 font-mono text-caption font-semibold text-white">
                      [{index + 1}]
                    </span>
                    <h3 className="text-card-title font-semibold">
                      {hit.documentTitle}
                    </h3>
                    {pages ? (
                      <span className="font-mono text-caption text-ink-muted">
                        {pages}
                      </span>
                    ) : null}
                    <span className="ml-auto flex items-center gap-2">
                      <span className="h-1 w-[70px] bg-line-soft" aria-hidden>
                        <span
                          className="block h-1 bg-accent"
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                      <span className="font-mono text-caption text-ink-muted">
                        {percent}%
                      </span>
                    </span>
                  </div>
                  <p className="text-ui leading-relaxed text-pretty text-ink-2">
                    {hit.snippet}
                  </p>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

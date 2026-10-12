"use client";

import { useState, useSyncExternalStore } from "react";

import { PageHeading } from "@/components/shell/page-heading";
import { Button } from "@/components/ui/button";
import { MarginValue } from "@/components/ui/margin-value";
import { LOW_MARGIN_THRESHOLD } from "@/config/analysis";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusPill } from "@/components/ui/status-pill";
import {
  dueLabel,
  FILTERS,
  filterAnalyses,
  isOverdue,
  minMargin,
  ownerLine,
  sortAnalyses,
  STATUS_LABEL,
  statusCounts,
} from "@/features/analyses/derive";
import { PEOPLE } from "@/features/analyses/fixtures";
import type {
  AnalysisFilter,
  AnalysisRecord,
  AnalysisSort,
  AnalysisView,
} from "@/features/analyses/types";
import { cn } from "@/lib/utils";

import { AnalysisDetail } from "./analysis-detail";
import { STATUS_CLASS } from "./status";

const VIEWS: readonly { value: AnalysisView; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
];

const SORTS: readonly { value: AnalysisSort; label: string }[] = [
  { value: "catalog", label: "Catalog order" },
  { value: "margin", label: "Lowest margin" },
  { value: "identifier", label: "Identifier" },
  { value: "due", label: "Due date" },
];

const SORT_LABEL: Record<AnalysisSort, string> = {
  catalog: "Catalog order",
  margin: "Lowest margin",
  identifier: "Identifier",
  due: "Due date",
};

function subscribeToHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => {
    window.removeEventListener("hashchange", onStoreChange);
  };
}

function currentHash(): string {
  return window.location.hash.replace(/^#/, "");
}

function selectAnalysis(id: string) {
  const next = `${window.location.pathname}${window.location.search}#${id}`;
  window.history.replaceState(null, "", next);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function sortValue(
  sort: AnalysisSort,
  column: AnalysisSort,
): "ascending" | "other" | "none" {
  if (sort !== column) {
    return "none";
  }

  return column === "catalog" ? "other" : "ascending";
}

export function AnalysesView({
  records,
  defaultSelectedId,
  marginThreshold = LOW_MARGIN_THRESHOLD,
}: {
  records: readonly AnalysisRecord[];
  defaultSelectedId: string;
  /** Organization cutoff. Defaults to `LOW_MARGIN_THRESHOLD`. */
  marginThreshold?: number;
}) {
  const [filter, setFilter] = useState<AnalysisFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AnalysisSort>("catalog");
  const [view, setView] = useState<AnalysisView>("grid");
  const hash = useSyncExternalStore(subscribeToHash, currentHash, () => "");
  const selectedId = records.some((record) => record.id === hash)
    ? hash
    : defaultSelectedId;

  const counts = statusCounts(records);
  const visible = sortAnalyses(filterAnalyses(records, filter, query), sort);
  const selected =
    records.find((record) => record.id === selectedId) ?? records[0];

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeading
        eyebrow="Step 03 · Analyze"
        title="Stress analyses"
        actions={
          <>
            <SegmentedControl
              label="Layout"
              value={view}
              options={VIEWS}
              onChange={setView}
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Filter by ID, identifier, zone, or name"
              aria-label="Filter analyses"
              className="w-60 border border-line-strong bg-surface px-3 py-2 text-body text-ink outline-none placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
            <label className="flex items-center gap-2 text-body text-ink-muted">
              <span className="font-mono text-caption tracking-label uppercase">
                Sort
              </span>
              <select
                value={sort}
                aria-label="Sort analyses"
                onChange={(event) => {
                  setSort(event.target.value as AnalysisSort);
                }}
                className="border border-line-strong bg-surface px-2 py-2 text-body text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button>New analysis</Button>
          </>
        }
      />

      <div
        role="toolbar"
        aria-label="Status"
        className="flex flex-wrap gap-1.5 border-b border-line pb-3"
      >
        {FILTERS.map((option) => {
          const pressed = filter === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => {
                setFilter(option.value);
              }}
              className={cn(
                "flex items-center gap-2 border px-[11px] py-1.5 text-[12.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                pressed
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-ink-2 hover:border-ink",
              )}
            >
              {option.label}
              <span className="font-mono text-caption opacity-70">
                {counts[option.value]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-1 basis-[360px]">
          {visible.length === 0 ? (
            <p className="border border-dashed border-line-strong px-10 py-10 text-center text-body text-ink-muted">
              No analyses match.
            </p>
          ) : view === "grid" ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {visible.map((record) => (
                <li key={record.id} id={record.id} className="scroll-mt-6">
                  <AnalysisCard
                    record={record}
                    selected={record.id === selected?.id}
                    onSelect={selectAnalysis}
                    marginThreshold={marginThreshold}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <AnalysisTable
              records={visible}
              selectedId={selected?.id}
              sort={sort}
              onSort={setSort}
              onSelect={selectAnalysis}
              marginThreshold={marginThreshold}
            />
          )}
        </div>
        {selected ? (
          <AnalysisDetail record={selected} marginThreshold={marginThreshold} />
        ) : null}
      </div>
    </div>
  );
}

function AnalysisCard({
  record,
  selected,
  onSelect,
  marginThreshold,
}: {
  record: AnalysisRecord;
  selected: boolean;
  onSelect: (id: string) => void;
  marginThreshold: number;
}) {
  const overdue = isOverdue(record);
  const analyst = PEOPLE[record.analyst];

  return (
    <button
      type="button"
      onClick={() => {
        onSelect(record.id);
      }}
      aria-pressed={selected}
      className={cn(
        "flex h-full w-full cursor-pointer flex-col border bg-surface text-left text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        selected ? "border-ink shadow-selected" : "border-line",
      )}
    >
      <span className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <span className="font-mono text-sub font-semibold">{record.id}</span>
        <StatusPill
          label={STATUS_LABEL[record.status]}
          size="xs"
          className={STATUS_CLASS[record.status]}
        />
      </span>
      <span className="min-h-9 px-3.5 pt-2 text-ui font-semibold text-pretty">
        {record.title}
      </span>
      <span className="px-3.5 pt-1.5 font-mono text-caption text-ink-muted">
        Identifier {record.identifier} · {record.zone}
      </span>
      <span className="mx-3.5 mt-3 flex items-center justify-between gap-2 border-t border-dashed border-line py-2.5">
        <span className="flex flex-col gap-0.5">
          <span className="font-mono text-micro tracking-th text-ink-faint uppercase">
            Min MS
          </span>
          <MarginValue
            margin={minMargin(record.cases)}
            threshold={marginThreshold}
            className="text-ms font-semibold"
          />
        </span>
        <span className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-micro tracking-th text-ink-faint uppercase">
            Repair
          </span>
          <span className="font-mono text-sub font-medium text-navy">
            {record.repair.id}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-2 border-t border-line-faint bg-paper-raised px-3.5 py-2.5">
        <span
          className="flex size-[22px] items-center justify-center rounded-full text-micro font-semibold text-white"
          style={{ backgroundColor: analyst.color }}
          aria-hidden
        >
          {analyst.id}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-3">
          {ownerLine(record)}
        </span>
        <span
          className={cn(
            "font-mono text-eyebrow",
            overdue ? "text-accent uppercase" : "text-ink-muted",
          )}
        >
          {dueLabel(record)}
        </span>
      </span>
    </button>
  );
}

function AnalysisTable({
  records,
  selectedId,
  sort,
  onSort,
  onSelect,
  marginThreshold,
}: {
  records: readonly AnalysisRecord[];
  selectedId: string | undefined;
  sort: AnalysisSort;
  onSort: (sort: AnalysisSort) => void;
  onSelect: (id: string) => void;
  marginThreshold: number;
}) {
  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-left text-body">
        <thead>
          <tr className="border-b border-line-faint bg-paper-raised">
            <SortHeader
              label="ID"
              column="catalog"
              sort={sort}
              onSort={onSort}
            />
            <th
              scope="col"
              className="px-3 py-2 font-mono text-eyebrow tracking-th text-ink-muted uppercase"
            >
              Item
            </th>
            <SortHeader
              label="Identifier"
              column="identifier"
              sort={sort}
              onSort={onSort}
            />
            <th
              scope="col"
              className="px-3 py-2 font-mono text-eyebrow tracking-th text-ink-muted uppercase"
            >
              Zone
            </th>
            <th
              scope="col"
              className="px-3 py-2 font-mono text-eyebrow tracking-th text-ink-muted uppercase"
            >
              Status
            </th>
            <SortHeader
              label="Min MS"
              column="margin"
              sort={sort}
              onSort={onSort}
            />
            <SortHeader label="Due" column="due" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const selected = record.id === selectedId;
            const overdue = isOverdue(record);

            return (
              <tr
                key={record.id}
                id={record.id}
                className={cn(
                  "scroll-mt-6 border-b border-line-faint",
                  selected ? "bg-paper-raised" : "hover:bg-paper-raised",
                )}
              >
                <th scope="row" className="px-3 py-2.5 font-normal">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(record.id);
                    }}
                    aria-pressed={selected}
                    className="font-mono text-xs font-semibold text-ink hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    {record.id}
                  </button>
                </th>
                <td className="max-w-[240px] truncate px-3 py-2.5">
                  {record.title}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-ink-3">
                  {record.identifier}
                </td>
                <td className="px-3 py-2.5 text-ink-3">{record.zone}</td>
                <td className="px-3 py-2.5">
                  <StatusPill
                    label={STATUS_LABEL[record.status]}
                    size="xs"
                    className={STATUS_CLASS[record.status]}
                  />
                </td>
                <td className="px-3 py-2.5 text-xs">
                  <MarginValue
                    margin={minMargin(record.cases)}
                    threshold={marginThreshold}
                  />
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5 font-mono text-eyebrow",
                    overdue ? "text-accent uppercase" : "text-ink-muted",
                  )}
                >
                  {dueLabel(record)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="sr-only">Sorted by {SORT_LABEL[sort]}.</p>
    </div>
  );
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: AnalysisSort;
  sort: AnalysisSort;
  onSort: (sort: AnalysisSort) => void;
}) {
  return (
    <th
      scope="col"
      aria-sort={sortValue(sort, column)}
      className="px-3 py-2 text-left"
    >
      <button
        type="button"
        onClick={() => {
          onSort(column);
        }}
        className="font-mono text-eyebrow tracking-th text-ink-muted uppercase hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {label}
      </button>
    </th>
  );
}

"use client";

import { useSyncExternalStore } from "react";

import { engineerRoleSchema, type EngineerRole } from "@/schemas";

const ID_KEY = "shipshape.dev-engineer-id";
const ROLE_KEY = "shipshape.dev-engineer-role";

const inputClass =
  "min-h-11 w-full border border-line-strong bg-surface px-3 py-2 text-base text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readItem(key: string): string {
  return window.localStorage.getItem(key) ?? "";
}

/**
 * Dev stand-in for the signed-in engineer.
 * TODO(#13): replace this picker with the session engineer.
 */
export function useDevEngineer(): {
  id: string;
  role: EngineerRole;
  update: (next: { id: string; role: EngineerRole }) => void;
} {
  const id = useSyncExternalStore(subscribe, () => readItem(ID_KEY), () => "");
  const storedRole = useSyncExternalStore(
    subscribe,
    () => readItem(ROLE_KEY),
    () => "analyst",
  );
  const role = engineerRoleSchema.safeParse(storedRole).data ?? "analyst";

  function update(next: { id: string; role: EngineerRole }) {
    window.localStorage.setItem(ID_KEY, next.id);
    window.localStorage.setItem(ROLE_KEY, next.role);
    emit();
  }

  return { id, role, update };
}

export function EngineerPicker({
  id,
  role,
  onChange,
}: {
  id: string;
  role: EngineerRole;
  onChange: (next: { id: string; role: EngineerRole }) => void;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-3 border border-line bg-paper-raised p-4 sm:flex-row sm:items-end">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-ui font-medium">
        Engineer
        <input
          value={id}
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
          onChange={(event) => {
            onChange({ id: event.target.value, role });
          }}
        />
      </label>
      <label className="flex w-full flex-col gap-1 text-ui font-medium sm:w-40">
        Role
        <select
          value={role}
          className={inputClass}
          onChange={(event) => {
            const next = engineerRoleSchema.safeParse(event.target.value);
            if (next.success) {
              onChange({ id, role: next.data });
            }
          }}
        >
          {engineerRoleSchema.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

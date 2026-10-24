# Contributing to ShipShape

## Branch and pull request workflow

1. Start from an up-to-date `main`.
2. Create a branch with a short, descriptive name, such as `feat/repair-form`.
3. Keep each commit focused on one change.
4. Open a pull request into `main` and fill in the pull request template, including how you tested.
5. Wait for CI. It runs `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`, then checks that `migrations/` matches `src/db/schema.ts` and applies those migrations to a throwaway Postgres database. The workflow does not need secrets. Drops and renames belong in their own pull request; see [docs/database.md](docs/database.md).

## Commits

Write [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): short summary
```

The scope is optional. Use a lowercase type and the imperative mood, the way the summary would complete “this commit will…”.

| Type       | Use for                                    |
| ---------- | ------------------------------------------ |
| `feat`     | A new capability                           |
| `fix`      | A bug fix                                  |
| `docs`     | Documentation only                         |
| `test`     | Tests only                                 |
| `ci`       | CI changes                                 |
| `chore`    | Tooling or maintenance                     |
| `refactor` | A code change that keeps behavior the same |

```text
feat(repairs): accept a repair opened from an issue
fix(schemas): reject an issue with no photos
docs: describe the local embedding contract
```

## Before you push

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

`pnpm format` rewrites files that fail the format check.

## Secrets

Put `DATABASE_URL` in `.env.local`. That file is gitignored. `.env.example` is the committed template and contains no real credentials.

## Where to put code

| You are adding…                       | Put it in               |
| ------------------------------------- | ----------------------- |
| A shape the UI and the server share   | `src/schemas`           |
| Server behavior for one workflow step | `src/server/<domain>`   |
| Tables or the database client         | `src/db`                |
| A page or a route handler             | `src/app`               |
| A shared component                    | `src/components`        |
| A page's view model and demo fixtures | `src/features/<domain>` |
| An app-wide constant                  | `src/config`            |

Domains already in the tree: `findings` (issues), `repairs`, `analyses`, `documents`.

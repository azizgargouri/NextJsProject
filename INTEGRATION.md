# Integrating feature branches into `dev`

How team branches get merged into `dev`, what has been merged so far, and what is still waiting. Update this page every time a branch is integrated.

## Branch model

| Branch               | Purpose                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `main`               | Stable and demo-ready. Only receives `dev` once `dev` is verified.         |
| `dev`                | Integration branch. Every feature branch is merged here first.             |
| `feat/*`, team names | One piece of work each. Start new work from `dev`, not from an old `main`. |

## How a branch is integrated

1. **Read the branch's description file** (for example `MOVER_SIDE.md`). If there is none, read its commits and diff before touching anything.
2. **Merge, don't rebase.** `git merge --no-ff origin/<branch>` into `dev`. Rebasing would rewrite a teammate's commits and force-push their branch.
3. **Try it first in a throwaway worktree** to list the conflicts:
   ```bash
   git worktree add --detach /tmp/mergetest dev
   cd /tmp/mergetest && git merge --no-commit --no-ff origin/<branch>
   git diff --name-only --diff-filter=U   # the conflicts
   ```
4. **Stop `yarn dev` before installing dependencies**, then resolve:
   - **Both sides added something** (barrels like `lib/api/index.ts`, `types/index.ts`, `package.json` dependencies and scripts): keep both.
   - **`yarn.lock`**: take `dev`'s, then run `yarn install` to add the branch's packages. Delete any `package-lock.json`; the project uses yarn only.
   - **Public landing, auth pages and admin shell**: `dev` owns them (rebuilt and verified). Keep `dev`'s version and re-apply only what the branch genuinely adds.
   - **Unused files** a resolution leaves behind (old images, dead components): remove them in the merge.
5. **Verify before committing the merge:**
   ```bash
   npx tsc --noEmit
   npx eslint .
   TEST_MONGODB_URI=mongodb://localhost:27017 yarn test:mover
   yarn dev   # then open /, /sign-in, the branch's own pages, /admin
   ```
6. **Commit the merge with its resolutions listed** in the message, push `dev`, then update this page and `AGENT_CONTEXT.md`.

## Project rules a branch must respect

- **yarn only.** No `package-lock.json`, and docs use `yarn` commands.
- **No invented data.** No fake counts, ratings, cities or testimonials. Launch cities are Tunis, Sfax and Sousse. Show an honest empty or unavailable state instead.
- **Photos must be openly licensed and credited** in `components/features/landing/photos.ts`. No `picsum.photos` or other placeholder services.
- **Two visual worlds.** The public site and the mover workspace use the Swiss Industrial Print style; `/admin` uses the compact back-office system (see `DESIGN.md`). Don't mix them.
- **i18n.** Landing copy goes in `lib/i18n/landing/{en,fr}.ts`, back-office copy in `lib/i18n/admin/{en,fr}.tsx`. Never hard-code UI strings there.
- **Backend pattern.** repository → service → schema (zod) → thin route, with typed domain errors from `server/shared/database/errors.ts`.

## Integration log

### `mover-side` (Salhi Firas) — merged 2026-11-09, merge `3ff42c0`

What it brought: the mover workspace (`/mover`: offers, jobs, calendar, earnings, profile), box scanning with QR labels, the profitability estimate and its trained duration model, the offline build (`yarn offline`), local fonts, and 150 mover tests. Full description: [MOVER_SIDE.md](MOVER_SIDE.md), offline guide: [OFFLINE.md](OFFLINE.md).

How the conflicts were resolved:

- **Landing and auth panel:** kept `dev`. The branch replaced placeholder photos with local copies and removed fake figures; `dev`'s landing rebuild had already done both with credited photos. The live metrics strip (`metrics.tsx`) stays removed from the landing; its query, `getPublicMetrics()` in `server/modules/mover/mover.public.ts`, is still available.
- **Barrels and `package.json`:** kept both sides (`jsqr`, `qrcode`, `@types/qrcode`; scripts `offline`, `ai:train`, `test:mover`).
- **Lockfiles:** `yarn.lock` regenerated, `package-lock.json` removed.
- **Removed** the 12 offline copies of the old placeholder photos, which nothing used any more.

Checks after the merge: type check clean, lint clean (0 errors), 150/150 mover tests pass, landing, mover sign-in to `/mover` and admin sign-in verified in the browser; an admin opening `/mover` is sent back to `/admin`.

Still open from this branch (see MOVER_SIDE.md section 9): offers need client move creation and admin dispatch/mover approval, which aren't built; `sweep()` needs a cron route; mover uploads use local disk (`.uploads`) and should move to the RustFS/S3 storage already used for avatars.

## Waiting to be integrated

Measured against `dev` on 2026-11-09:

| Branch                       | Author         | Ahead | Behind | Files | Description file            |
| ---------------------------- | -------------- | ----- | ------ | ----- | --------------------------- |
| `requests-and-inventory`     | aziz           | 2     | 35     | 172   | none                        |
| `rh-and-employee-tracking`   | fedibenman     | 8     | 35     | 192   | none                        |
| `smart-room`                 | Omar Degani    | 6     | 24     | 67    | `SMART_ROOM_LAYOUT_PLAN.md` |
| `feat/member6-quality-ai-v2` | abderrahmen007 | 2     | 24     | 100   | none                        |
| `unified-all-features`       | Omar Degani    | 26    | 20     | 281   | `SMART_ROOM_LAYOUT_PLAN.md` |

Notes for the next merges:

- **`unified-all-features`** already combines several branches and probably overlaps with `smart-room`. Check what it contains before merging both, so the same work isn't merged twice.
- **`requests-and-inventory`** likely touches client move creation, which the mover side is waiting for (MOVER_SIDE.md section 8). It should create `MoveRequest` documents the way `dispatchMove()` expects, and its inventory should reuse `lib/inventory/catalogue.ts` and the AI inventory endpoint already on `dev`.
- Branches without a description file: ask the author for one, or write it from the diff as part of the merge.

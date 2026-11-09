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

### `main` → `dev` sync — 2026-11-09, merge `677e919`

A teammate merged `unified-all-features`, `smart-room`, `rh-and-employee-tracking`, `feat/member6-quality-ai-v2`, `requests-and-inventory` and the first `mover-side` commit straight into `main` (36 commits, about 500 files). `dev` took all of it:

- **Conflicts:** `env.ts`, `mongoose.ts`, the API and model barrels, `types/index.ts` and `package.json` scripts all kept both sides. `mongoose.ts` keeps `dev`'s configurable `MONGODB_DB_NAME` plus `main`'s in-memory fallback when a local MongoDB is not running. `types/index.ts` re-exports the mover types by name because `MoveItemDto` exists in both `homes` and `mover`.
- **Fixed from `main`:** 3 lint errors (unused variables in contracts and leave-requests), `package-lock.json` removed again, `.env.example` lost the storage and Ollama sections and named the blockchain variables wrongly (`CHAIN_*` instead of `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CONTRACT_ADDRESS`, `CONTRACT_ADMIN_PRIVATE_KEY`, which `env.ts` reads); all restored.
- **Checks:** tsc clean, eslint 0 errors, `yarn test` 18/18, `yarn test:mover` 150/150, `next build` succeeds (one warning from inside `@ai-sdk/provider-utils`, not our code).

**Rule going forward:** nobody pushes features straight to `main`. Merge into `dev`, verify, then open a pull request from `dev` to `main`.

### `smart-room` (Omar Degani) — merged 2026-11-09, merge `791d0c1`

Description: `SMART_ROOM_LAYOUT_PLAN.md` on the branch. Most of the branch had already reached `dev` through `main`; only the "1 item / 2 items" pluralisation fix was new. No conflicts.

Shared setting to know about: the smart room planner and the landing inventory assistant both read `OLLAMA_MODEL` (a text model). The planner falls back to Groq (`GROQ_API_KEY`) when Ollama is missing or slow; the inventory assistant says it is offline instead.

### Mover routing restored — 2026-11-09

The `main` sync brought the HR module's routing, which sent every `MOVER` to `/me` (the HR employee page) after sign-in, so movers never reached the mover workspace. Decision: **a `MOVER` lands on `/mover`** (sign-in, sign-up, the auth "Continue" link, `/dashboard`, and the redirect away from admin-only pages). The HR pages (`/me`, contracts, profile) stay reachable for movers who are also employees. Verified: sign-in lands on `/mover`, and the dashboard, application, offers, jobs, availability, earnings, notifications and profile pages all render the mover-side interface with no page errors.

When another branch touches post-sign-in routing, keep this rule: `ADMIN` → `/admin`, `MOVER` → `/mover`, `CLIENT` → `/request` (unless a `redirect`/`next` parameter is given).

## Waiting to be integrated

Measured against `dev` on 2026-11-09, after the `main` sync:

| Branch                       | Author         | Not yet in `dev`                                                                      |
| ---------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| `rh-and-employee-tracking`   | fedibenman     | 6 commits, 11 files: voice check-in fixes (16 kHz WAV, stored recordings) and RH docs |
| `requests-and-inventory`     | aziz           | nothing (fully merged)                                                                |
| `feat/member6-quality-ai-v2` | abderrahmen007 | nothing (fully merged)                                                                |
| `unified-all-features`       | aziz           | nothing (fully merged)                                                                |
| `mover-side`                 | Salhi Firas    | nothing (fully merged)                                                                |

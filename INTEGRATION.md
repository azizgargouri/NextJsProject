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

### Smart room check and one workspace header — 2026-11-09

Compared `dev` with the `smart-room` branch page by page, running the branch side by side on port 3100 against the same database.

- **`dev` has the newer smart room code.** Omar's later commits (homes reading the client's real Moves instead of static demo requests, one dashboard shell for the homes pages) reached `dev` through `main`. The branch still has the older standalone version, so nothing was copied back from it.
- **The UI matches:** house list, add a house, the house page with rooms drawn to scale, doors and windows, layout and drag-and-drop editor.
- **One behavioural difference, by design:** on the branch, "Moving in" offers static sample requests (`MU-2026-DEMO00x`). On `dev` it lists the client's real moves, so a client must book a move first (Book move → `POST /api/moves`). Verified end to end: booked a move, linked it to a house, generated the layout with Ollama (`qwen2.5-coder:7b`, 27 s, 4 of 4 items placed in sensible rooms).
- **Header:** the signed-in shell now has one role-aware header (`components/features/workspace/workspace-links.tsx`) instead of HR links plus a second workspace bar:
  - client: Overview · Book move · Live tracking · Smart rooms · Claims · Reviews · Assistant;
  - mover (on the HR pages): Mover workspace · HR file · Contracts · Profile;
  - admin: unchanged HR and back-office links.

  `/request` and `/track` stay open to guests, and show the same client links to signed-in clients.

### Static demo moves for testing — 2026-11-09

`yarn db:seed:demo-moves` (after `yarn db:seed`) adds three static move requests for `client@moveup.tn`: `MU-2026-DEMO01` (37 items, Tunis → Sfax), `MU-2026-DEMO02` (14 items) and `MU-2026-DEMO03` (12 items), taken from the `smart-room` branch's sample data. They are created through the booking service, so they are ordinary Moves and appear in Smart Rooms, Live tracking and the dashboard. It also creates the house "Demo flat, Sfax" (5 rooms) linked to `MU-2026-DEMO01`. Idempotent; delete the `MU-2026-DEMO0x` moves when real bookings exist.

Tested: the AI layout for "Demo flat, Sfax" placed all 37 pieces (24 placements, boxes stacked) with the local `qwen2.5-coder:7b` in 87 s. The small model put the washing machine in the office and the desk in the main bedroom; drag them in the editor, or use Groq or a larger Ollama model for better placements.

### `rh-and-employee-tracking` (fedibenman) — merged 2026-11-09, merge `e0e6a65`

Description: `docs/IMPLEMENTATION.md`. Most of the module (employees, attendance, leave, crews, tracking, contracts, custodial wallets) already reached `dev` through `main`, and `dev`'s copy is newer where they differ. The merge brought the last six commits: server-generated voice challenge, listen-before-send recording, HR playback of faulty attempts, 16 kHz WAV conversion. No conflicts.

- Fixes: unused variable in the HR dashboard; `force-dynamic` on the voice routes; voice check-in answers 503 (service not configured / unreachable) or 400 (not JSON) instead of a bare 500.
- Navigation: HR employees (CLIENT accounts with an employee record) get "HR file" and "Contracts" in the header; the admin sidebar has "HR workspace" (EN/FR) → `/dashboard`.
- Decisions (merge notes §6): one `ADMIN` role for back office and HR; `/dashboard` renders HR for `ADMIN` and the client workspace for everyone else.
- Setup: `WALLET_ENCRYPTION_KEY` is required by `yarn db:seed` (HR wallets) and must never change once wallets exist. The voice check-in needs `VOICE_API_BASE_URL` (the Kaggle notebook's ngrok URL).
- HR demo logins: `hr@moveup.tn` / `Hr#2026!` (ADMIN); `alice|bob|carol|dave|eve@moveup.tn` / `Demo#2026!` (CLIENT employees).

### `feat/member6-quality-ai-v2` (abderrahmen007) — merged 2026-11-09

Description: `docs/member-6-v2-quality-ai.md`, `seed-data/README.md`. Brings the multimodal Vision AI claim scanner (red-rectangle damage zones, three demo presets), the AI dispute mediator, the mover scorecard, the evidence gallery and printable dossier, and a demo data kit.

- Conflicts: `next.config.ts` keeps `dev`'s offline `distDir` plus the branch's 8 MB Server Action limit (claim photos); the branch's picsum image domains were dropped (no placeholder photos). The claim and review forms and pages take the branch's new UI.
- Logical integration: the branch's move picker used four invented moves (`MV-2026-0155` …). It now lists the client's **real** moves (`server/modules/moves/moves.options.ts`), and keeps `dev`'s pre-fill from the tracking page (`?moveRef=&moverId=`).
- Vision AI uses the configured `OLLAMA_URL` (was hard-coded to `127.0.0.1`) and `OLLAMA_VISION_MODEL` (`qwen2.5vl:7b` locally); with no cloud key it falls back to its rule engine.
- Checks: tsc clean, eslint 0 errors, `yarn test` 21/21, `next build` succeeds; claim picker, pre-fill, client claims list and admin disputes verified in the browser. Demo data: `yarn db:seed:quality`.

### Member 6 mover and admin wiring — 2026-11-09

Followed `CLAUDE_MOVER_INTEGRATION_GUIDE.md` (from the member6 branch). The quality backend already supported the `MOVER` role, but nothing in the mover workspace reached it, and the admin sidebar still labelled working modules "Soon".

- Mover app: Claims, Reviews and Assistant in the header and bottom bar; `/mover/claims` (+ detail with AI reply suggestions), `/mover/reviews`, `/mover/assistant` render the shared pages inside the mover shell instead of sending movers to the client workspace. The profile has a Reputation panel with the AI trust scorecard and a link to the public page `/movers/[id]`.
- Links inside the shared pages follow the role (`lib/quality/paths.ts`); the server actions revalidate both `/dashboard` and `/mover` paths.
- Admin: Move requests, Assignments, Disputes and Customer reviews no longer show "Soon" (their portals are built); Mover reviews still does.
- Verified as `mover@moveup.tn`: claims list and detail stay in `/mover`, reviews, assistant, scorecard generation; the client's claim links still go to `/dashboard`.

## Waiting to be integrated

Measured against `dev` on 2026-11-09, after the `main` sync:

| Branch                   | Author      | Not yet in `dev`       |
| ------------------------ | ----------- | ---------------------- |
| `requests-and-inventory` | aziz        | nothing (fully merged) |
| `unified-all-features`   | aziz        | nothing (fully merged) |
| `mover-side`             | Salhi Firas | nothing (fully merged) |

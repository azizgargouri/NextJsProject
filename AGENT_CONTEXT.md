# AGENT_CONTEXT.md — agent brief for the MoveUp project

Handoff context for any AI agent working in this repository. Read fully before touching code.

## One-liner

MoveUp is a Tunisian moving-service platform: a Swiss-print public landing, auth for three roles, and an admin back office for a fictional company ("Société MoveUp"). Run by solo developer azizgargouri (working with an AI agent as the coding teammate).

## Stack and rules

- Next.js 15 App Router + TypeScript, React Query, Zustand, react-hook-form + zod, Radix overlays, lucide icons.
- MongoDB via Mongoose (recently migrated; v9 API — see Hazards).
- Object storage: S3-compatible RustFS in Docker (`docker-compose.yml`), accessed with `@aws-sdk/client-s3` (path-style).
- Dependency manager: yarn v1 only (no npm/pnpm).
- GSAP everywhere on the landing: real ScrollTriggers, `prefers-reduced-motion` respected.
- Editorial style rules (enforced by the developer):
  - No emojis. No Inter. No placeholder junk ("coming soon" divs, fake data, lorem ipsum).
  - Never invent data that pretends to be real. Empty states must be honest.
- Everything in English code with clear short commits, conventional style (`feat(admin): ...`).

## Commands

```bash
yarn dev          # port 3000 (keep running for dev; kill before building)
yarn build        # production build — kill `yarn dev` first (see Hazards)
yarn lint         # has 3 pre-existing <img> warnings on landing files — baseline, not a failure
yarn db:seed      # idempotent seed (users, pricing rule, content entries)
yarn db:reset     # drop moveup DB + seed again
npx tsc --noEmit  # typecheck
docker compose up -d   # RustFS: S3 API :9000, console :9001; `rustfs-init` (rustfs/rc) creates the bucket
```

Prettier: use `npx prettier --write <file>` per file — brace-expansion globs fail in the agent shell.

## Environment

- Dev DB: local `mongod` (brew service `mongodb-community`), database `moveup`.
- Object storage: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` in `.env` (defaults match `docker-compose.yml`). Storage env is validated lazily (`server/shared/storage/s3.ts`): the app boots without it and storage calls answer 503.
- Never run `yarn add` while `yarn dev` is live — the dev server loses moved node_modules paths (ENOENT tslib); restart it with a fresh `.next`.
- Dev server normally runs on port 3000 in the background during a session.
- Env vars in `.env`; note that unquoted dotenv values are truncated at `#` — keep secrets quoted (`Admin#2026!`).
- Auth: JWT access token in `Authorization: Bearer <token>`; role `ADMIN` required for all `/api/admin/*`.
- Demo accounts (after `yarn db:seed`):
  - `admin@moveup.tn` / `Admin#2026!` (ADMIN)
  - `client@moveup.tn` / `Demo#2026!` (CLIENT)
  - `mover@moveup.tn` / `Demo#2026!` (MOVER, approved, has mover profile)

## Repo map

```
app/
  page.tsx                       # public landing — async server comp, force-dynamic, serves managed copy
  (public)/auth pages            # sign-in/sign-up (auth module)
  (admin)/admin/*                # back office pages (portal pattern: page just mounts a portal)
  (dashboard)/dashboard          # client dashboard
  api/
    auth/*                       # sign-in, sign-up, sign-out, refresh-token, me
    admin/users/…                # users CRUD
    admin/audit/route.ts         # audit log list (paginated)
    admin/pricing/…              # pricing rules CRUD
    admin/content/route.ts       # content GET bundle / PATCH save / PATCH ?mode=reset
    admin/storage/…              # bucket status; objects list / download (?key=) / DELETE (?key=)
    account/*                    # self-service (any role): profile, avatar, password, sessions, notifications
    files/avatars/[userId]       # public avatar proxy from the bucket (versioned ?v=, immutable cache)
server/
  shared/database/               # mongoose.ts, models/, enums, errors, pagination, query-builder
  shared/auth/guards.ts          # requireAdmin, errorResponse
  shared/logger/audit.ts         # EventType enum + async fire-and-forget logEvent
  modules/
    auth/ users/ admin/          # existing modules (repository → service → schema → controller/routes)
    pricing/                     # pricing-rule module (same anatomy)
    content/                     # landing copy module (constants hold CONTENT_DEFAULTS)
    account/                     # self-service account (profile, avatar bytes sniffing, password, sessions, notification feed)
    storage/                     # admin bucket browser; deleting an avatar object clears the user's avatarKey
  shared/storage/s3.ts           # S3 client + put/get/delete/list/usage/ping
  seed.ts                        # idempotent seeder
components/
  ui/                            # shared Client-UI kit (AdminButton, AdminCard, AdminSheet, AdminDialog, AdminSelect, AdminBadge, AdminInput…)
  features/landing/              # nav, hero, marquee, metrics, services, how-it-works, manifesto, coverage, become-mover, footer
  features/admin/
    shell/                       # admin shell + admin-nav.ts + AdminShellContext (setPage/setFooter)
    overview/ users/ audit/ pricing/ content/
types/index.ts                   # ALL shared DTOs/types
lib/api/                         # axiosClient + api.admin.* methods
hooks/content/admin/             # useAdminOverview, useAdminAudit, useAdminUsers, useUserStatus, useUserMutations, useAdminPricing, useAdminContent, useAdminMutations, useCreateAdminUser/UpdateAdminUser (barrel: hooks/content/admin/index.ts — keep ALL exports intact)
docs/ md files at root: DESIGN.md, NEXTJS_PROJECT_PROMPT.md, PRODUCT.md
```

## Backend anatomy (follow it for new modules)

Module folder `server/modules/<feature>/`:

- `<feature>.model.ts` style models live in `server/shared/database/models/` (schema + `Model<XDoc>` + barrel export in `models/index.ts` + doc interface).
- `<feature>.repository.ts` — data access only; lazy `connectMongo()`; serializes docs to plain DTOs; pagination via `parseListQuery`/`compileSort` + `createPageDto`.
- `<feature>.service.ts` — business rules; throws domain errors (`NotFoundError`, `ValidationError` (422 with `details`), `AlreadyExistsError`, `ForbiddenError`) from `server/shared/database/errors.ts`.
- `<feature>.schema.ts` — zod validation. Caution: zod cannot `.partial()` a schema containing `.refine()` — keep a base object schema, refine the create version, `.partial()` the base for update.
- `<feature>.serializer.ts` or fields on repository — dates → ISO strings.
- `index.ts` barrel. API routes under `app/api/...` decide verbs, call `requireAdmin(request)`, parse with zod, log `logEvent` (fire-and-forget), and return via `errorResponse(error)` in catch.
- Audit: every mutating admin action fires `logEvent` with a distinct `EventType` (SIGNIN, SIGNOUT, SIGNUP, REFRESH_TOKEN, USER_CREATE, USER_UPDATE, USER_DELETE, USER_STATUS, PRICING_CREATE, PRICING_UPDATE, PRICING_DELETE, CONTENT_UPDATE, PROFILE_UPDATE, AVATAR_UPDATE, PASSWORD_CHANGE, SESSION_REVOKE, STORAGE_DELETE). Adding a new EventType means: enum in `server/shared/logger/audit.ts`, union in `types/index.ts` (`AuditEventType`), label + variant maps in `components/features/admin/audit/audit-portal.tsx`. `AuditQuerySchema` derives from `Object.values(EventType)` automatically.

Mongoose v9 specifics: no `FilterQuery` export (use `Record<string, unknown>`), use `returnDocument: 'after'` on findOneAndUpdate.

## Front-end admin pattern

- Route page (`app/(admin)/admin/x/page.tsx`) exports metadata and mounts `<XPortal />`.
- Portal (client component) uses `useAdminShell()` from `../shell/admin-shell-context` to publish breadcrumbs/title/actions setFooter pagination (`setPage` in a mount effect with cleanup, `setFooter` with cleanup).
- Data via React Query hooks (`useQuery` with `placeholderData: previous`, mutations invalidate `['admin', ...]` keys).
- Table: sort buttons in `<th>`, skeleton rows while pending, honest empty and error states with retry.
- Row actions: Radix `DropdownMenu` (Edit / toggle status / destructive Delete with `AdminDialog` confirm).
- Forms: sheet (`AdminSheet`) + `react-hook-form` + zodResolver; selects via `Controller` wrapping `AdminSelect` (it is controlled: value/onValueChange/options/ariaLabel); server 422 `details.fieldErrors` mapped back onto RHF errors via `setError`.
- Mutation toasts via sonner (`toast.success` / `toast.error` with server message).
- Status ownership: show explicit version numbers / audit-friendly hints where relevant (pricing shows `v3`, content shows Default/Managed/Unsaved badges).

## Current state (all committed and pushed)

- Auth module complete (sign-up/sign-in/sign-out/refresh/me, JWT + refresh tokens, guards). Roles: ADMIN, CLIENT, MOVER (+ MOVER profile model).
- Public landing: full Swiss-print AIDA page with GSAP; hero + how-it-works steps + coverage intro now come from managed content (Mongo override or in-code defaults, `force-dynamic`, DB failure falls back gracefully).
- Back office shell (light/dark/system theme, one blue accent, 4px rhythm) + overview module (real counters) + Users CRUD + real Audit log portal.
- Pricing rules module: complete CRUD, activation exclusivity (one ACTIVE rule; activation auto-retires others), versioning, soft delete, effective-window validation, seed rule "MoveUp Standard 2026".
- Content module: 14 managed keys × 3 locales over the landing copy; save-per-section; restore defaults (removes DB overrides); seed writes defaults for en/fr/ar.
- Account menu: Profile (`/admin/profile`, avatar in RustFS), Account settings (`/admin/settings`: password change with optional sign-out of other devices, signed-in device list from refresh tokens, theme), Notifications (`/admin/notifications` + header bell unread count). Notifications are derived from audit events (others' workspace changes for admins; own security events; changes to your account by others) with `notificationsSeenAt` on the user.
- Back-office i18n (EN/FR): `lib/i18n/admin/{en,fr,index}.tsx` — typed dictionaries (`fr: AdminMessages` must match `en`), `AdminI18nProvider` inside `AdminShell`, `useAdminI18n()` → `{ m, fmt, locale, setLocale }`. Locale = the signed-in user's `locale` (`ar` falls back to `en`); the header EN/FR switch and Settings both PATCH `/api/account/profile`. Never hard-code admin UI strings — add keys to both dictionaries; use `fmt.*` for dates/money/bytes. Nav items carry a `key` (labels from `m.nav.items`). Server error messages are still English (password "current incorrect" is mapped client-side).
- Storage portal (`/admin/storage`): bucket reachability/usage, cursor-paginated object list with owner + in-use flag, download, delete.
- Nav: every module routes; remaining unbuilt modules show a "Soon" badge and land on an honest "not connected" page: Move requests, Assignments, Disputes, Mover reviews, Customer reviews.

## Likely next features (not built yet — do not assume otherwise)

- Move requests (client-side creation + admin management), where quoting must consume the currently ACTIVE pricing rule.
- Assignments, disputes, mover/customer reviews.
- Quote estimator then consumes pricing fields (perM3, expressSurcharge, minQuote are recorded but not yet used by any quote logic).
- Auth UI polish/verification flows, e-mail, moderation tooling.

## Hazards (learned the hard way)

1. NEVER run `yarn build` while `yarn dev` is live — both share `.next`; the dev chunk cache gets corrupted ("Cannot find module './897.js'") and the server can get permanently stuck. Kill port 3000 first: `lsof -ti :3000 | xargs kill -9`, build, restart.
2. First compile of a new route in dev is slow (~1–20 s). Screenshot/curl polls must be up to 60–90 s, not fixed short sleeps.
3. `next build` can fail once transiently on a next/font Google Fonts fetch (`TypeError: Cannot read properties of null`) — retry the build before debugging.
4. Lint failures during `next build`: unused variables (`@typescript-eslint/no-unused-vars`) are build-breaking errors — clean imports before building.
5. zod: `.partial()` on a schema that has `.refine()` throws at build ("page data collection") — restructure as base + refine (see `server/modules/pricing/pricing.schema.ts`).
6. Prettier: pass explicit file paths; glob braces do not expand in this shell.
7. Before committing UI work run the impeccable checker: `node /Users/Apple/.agents/skills/impeccable/scripts/detect.mjs --json <files>`.

## Git workflow

- Remote: HTTPS only — `https://github.com/azizgargouri/NextJsProject.git`, branch `main` (SSH fails on this machine; `gh` CLI not installed).
- Push pattern: `git push https://github.com/azizgargouri/NextJsProject.git main` — then `git fetch origin` so status stops showing "ahead" (URL pushes do not update the origin ref).
- Make short, atomic, conventional commits; keep `git status` clean (nothing untracked except ignored artifacts). commit splits so far: api/backend / admin UI / landing / db seed.

## UI verification protocols (quick reference)

- Headless Chrome CDP screenshots at `http://localhost:9222` (`--headless=new --remote-debugging-port=9222 --user-data-dir=/tmp/moveup-chrome` in background), `Emulation.setDeviceMetricsOverride 1600×950`, inject `localStorage['moveup-auth'] = {"state":{user, accessToken, isAuthenticated:true},"version":0}` (fetch session blob from `POST /api/auth/sign-in` → `GET /api/auth/me`) after navigating to `/sign-in` once, `localStorage['theme'] = 'dark'`, then navigate to the target admin route and poll `document.body.innerText` for a rendered known string; save what `Page.captureScreenshot` returns as PNG.
- API smoke tests: get admin token via sign-in endpoint (see curl in chat history if needed — this repo pattern: `curl -s -X POST http://localhost:3000/api/auth/sign-in -d '{...}'`), then GET list / POST create / PATCH semantics / DELETE, plus client-role 403 checks and row inspect of `/api/admin/audit`.

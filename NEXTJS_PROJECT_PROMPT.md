# Next.js Full-Stack Project — Architecture & Best-Practices Prompt

> Use this prompt to scaffold/build a **single Next.js full-stack application** (App Router) that
> reuses the architecture, conventions, and clean-code practices extracted from the
> **Instanct** codebase (`instanct-api` NestJS backend + `instanct-ui` Next.js frontend
> + `instanct-mobile-app` React Native).

---

## 1. Role & Goal

You are a senior full-stack engineer. Build a production-grade **Next.js (App Router) application**
that serves both the **backend** (API) and the **frontend** (UI) in a single codebase, following the
layered, modular, and convention-driven architecture described below.

The backend logic that currently lives in NestJS (`controller → service → repository → entity/DTO`)
must be **mapped onto Next.js Route Handlers** while preserving the same layering, separation of
concerns, and generic/reusable infrastructure. The frontend must reproduce the exact design system,
data-fetching, state, and component patterns of `instanct-ui`.

---

## 2. Reference Projects (what to inherit)

Analyzed codebase conventions you must reproduce:

| Concern | Source | Pattern to inherit |
|---|---|---|
| Backend layering | `instanct-api` | `controller → service → repository → entity`, feature modules, shared modules |
| Generic DB layer | `instanct-api/src/shared/database` | Abstract repository, abstract CRUD service, pagination DTOs, query DSL |
| DTO/validation | `instanct-api` | Create/Update/Response DTOs, response serialization (whitelist/`@Expose`) |
| Errors | `instanct-api` | Typed HTTP exception classes per domain (`NotFound`, `AlreadyExists`, …) |
| Auth | `instanct-api` + `instanct-ui` | JWT access+refresh, `@Public`, OAuth, token sync into client store |
| Frontend UI | `instanct-ui` | shadcn/ui + Tailwind, CVA, declarative FormBuilder, reusable DataTable |
| Data fetching | `instanct-ui` | TanStack Query hooks, Axios interceptors, Zustand stores |
| Types | `instanct-ui/src/types` | Mirror backend DTOs, `DatabaseEntity`, `Paginated<T>`, `QueryParams` |

---

## 3. Locked Tech Stack

### Core
- **Next.js 15+ (App Router)** with **React 19**, **TypeScript (strict)**
- Package manager: **yarn** (v1, frozen lockfile)

### Backend (Route Handlers / server)
- Next.js **Route Handlers** (`app/api/**/route.ts`) for HTTP endpoints
- **Zod** for request validation and schema definition (replaces `class-validator` DTOs)
- **Drizzle ORM** or **Prisma** for the data layer (replaces TypeORM). Prefer a single ORM with a
  repository abstraction layer (see §5.4).
- **JWT** (`jose`) for auth tokens; **bcrypt** for password hashing
- **Resend/Nodemailer** for mail (replaces `@nestjs-modules/mailer` + MX resolution)
- **AWS SDK S3 / MinIO** for object storage with a **provider/strategy pattern** (local ↔ S3)

### Frontend
- **shadcn/ui** (style `new-york`, base color `neutral`, CSS variables), **Tailwind CSS v4**
- **class-variance-authority** (`cva`) + `clsx` + `tailwind-merge` → `cn()`
- **TanStack Query** (React Query) for server state
- **Zustand** for client state (with `persist` middleware where needed)
- **Axios** for the HTTP client (interceptors)
- **Auth.js / NextAuth v5** for authentication (credentials + OAuth)
- **next-intl** or **next-i18next** for i18n, **next-themes** for theming
- **lucide-react** icons, **react-hook-form** + **zodResolver** for forms
- **@tanstack/react-table** for data tables

### Tooling
- **ESLint** (typescript-eslint `recommendedTypeChecked`), **Prettier** (`singleQuote`, `trailingComma: all`)
- **Docker** multi-stage build with **distroless** runtime; **GitHub Actions** CI/CD deploy via SSH
- Env validation on boot (fail fast with a clear error)

---

## 4. Project Structure

```
app/                         # App Router (frontend pages + API route handlers)
  layout.tsx                 # Root layout (providers, theme, fonts)
  (auth)/                    # Public auth route group
    login/page.tsx
  (dashboard)/               # Protected route group (app shell layout)
    layout.tsx
    page.tsx
    users/
      page.tsx               # list
      [id]/page.tsx          # detail
  api/                       # BACKEND — Route Handlers (see §5.2)
    auth/
      sign-in/route.ts
      refresh-token/route.ts
    users/
      route.ts               # GET (list), POST (create)
      [id]/route.ts          # GET/PUT/DELETE
server/                      # BACKEND — all server-side business logic (no React)
  modules/                   # feature modules (mirror NestJS modules)
    users/
      users.controller.ts    # HTTP handlers, thin (parse → service → serialize)
      users.service.ts       # business logic
      users.repository.ts    # data access
      users.schema.ts        # Zod schemas (create/update/query)
      users.serializer.ts    # response DTO mapping
      users.errors.ts        # typed errors
      users.types.ts
    auth/
    ...
  shared/                    # cross-cutting infrastructure (mirror instanct-api/src/shared)
    database/
      repository.ts          # abstract repository (generic CRUD)
      crud-service.ts        # abstract CRUD service
      pagination.ts          # PageDto / PageMetaDto
      query-builder.ts       # query DSL (filter/sort/search/select/join)
      errors.ts
    auth/                    # guards, current-user, require-auth, is-public
    logger/                  # structured logging + audit event logging
    storage/                 # provider pattern (local ↔ S3)
    mail/
    notifications/
  config/                    # env config + validation (Zod schemas per namespace)
    env.ts
  db/                        # ORM client, schema, migrations, seeders
    schema/
    migrations/
    seed/
components/
  ui/                        # shadcn/ui primitives
  shared/
    form-builder/            # declarative form system
    data-table/              # TanStack Table wrapper
  layout/                    # sidebar, header, footer, page-header
  features/                  # feature-specific components (co-located, by domain)
hooks/
  content/                   # TanStack Query hooks (server state)
  stores/                    # Zustand stores (client state)
lib/                        # framework-agnostic utils (cn, object, date, …)
types/                      # shared TS types mirroring backend DTOs
i18n/                        # locales + config
styles/globals.css
```

Rules:
- **Backend code lives in `server/` and `app/api/`** and never imports React components.
- **Frontend code never imports from `server/`** — it talks to the backend only via the typed API
  client in `lib/api/`.
- Shared types are exported from a single barrel (`types/index.ts`).

---

## 5. Backend Architecture (Route Handlers)

### 5.1 Layer responsibilities (strict, from `instanct-api`)

| Layer | Responsibility | MUST NOT do |
|---|---|---|
| **Controller** (`app/api/**/route.ts`) | Parse/validate request (Zod), call service, serialize response, map errors to HTTP | Business logic, DB access |
| **Service** | Business logic, orchestration, transactions | HTTP concerns, raw SQL |
| **Repository** | All data access, transactions, association diffing | Business rules |
| **Schema** (Zod) | Request/response shape + validation | — |
| **Serializer** | Map entity → response DTO (whitelist fields) | — |
| **Errors** | Typed domain errors | — |

### 5.2 Route Handler ↔ Controller pattern

- Thin route handlers that only adapt HTTP to the service layer. Example:

```ts
// app/api/users/[id]/route.ts
import { usersController } from "@/server/modules/users/users.controller";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return usersController.findOne((await params).id);
}
```

- A `Controller` returns a normalized `NextResponse` / typed result and centralizes error mapping
  (`DomainError → HTTP status`).
- **Versioning + prefixing**: keep all API under `/api` (replicates the NestJS global prefix).

### 5.3 DTO / Schema conventions (mirror `create-*/update-*/response-*`)

For every entity, define:
- `*CreateSchema` / `*UpdateSchema` (Zod) — request validation
- `*Response` (serializer) — **whitelisted** output shape (never expose `password`, internal ids)
- `*QuerySchema` — list/query params

Naming (reuse from the codebase):
- `ResponseUserDto` → `UserResponse`
- `CreateUserDto` → `UserCreateInput`
- `UpdateUserDto` → `UserUpdateInput`
- `ResponseUserUploadDto` → `UserUploadResponse`

### 5.4 Repository pattern (replaces TypeORM repository)

Implement a **generic `AbstractRepository<T>`** with:
- `findOne`, `findOneById`, `findAll`, `findWithRelations`
- `create`, `save`, `saveMany`, `upsert`, `preload`
- `update`, `updateMany`, `remove`, `delete`, `deleteMany`, `deleteAll`
- `softDelete`, `softDeleteMany`
- `updateAssociations(...)` and `updateJunctionAssociations(...)` — diff existing vs. updated
  related items into `keptItems / newItems / updatedItems / eliminatedItems` (copy this exact
  utility; it is used for many-to-many and one-to-many sync in `instanct-api`).
- Transaction support: every write method runs in a transaction (replaces `@Transactional()`).

Then each domain repository extends it:
```ts
class UserRepository extends AbstractRepository<User> {
  // domain-specific queries only
  findByEmail(email: string) { ... }
}
```

### 5.5 Abstract CRUD service

Implement `AbstractCrudService<T>` exposing:
`findOneById`, `findOneByCondition`, `findAll`, `findAllPaginated`, `save`, `saveMany`,
`update`, `updateMany`, `softDelete`, `delete`.
Domain services (`UserService`) extend it and add only domain-specific methods.

### 5.6 Pagination (replicate exactly)

```ts
interface PageMetaDto { page; take; itemCount; pageCount; hasPreviousPage; hasNextPage }
interface PageDto<T> { data: T[]; meta: PageMetaDto }
```

- `page` default `1`, `take` default `10`, max `50` (validated).
- Every list endpoint returns `PageDto<T>` when it supports pagination.

### 5.7 Query DSL (replicate `database-query-builder.ts`)

Standardize list/query params so the client can filter/sort/search without custom endpoints:

```
select      comma list of fields
join        comma list of relations
sort        "field,ASC;field2,DESC"      (delimiter ;)
filter      "field||$eq||value"          operators: $eq $cont $starts $ends $gt $gte $lt $lte $in $between $isnull $or, "!" negation
search      "text"
page, limit
```

Implement a `QueryBuilder` that compiles these into the ORM query.

### 5.8 Errors (typed, one class per error)

Mirror `instanct-api/src/**/errors/**`:
- `UserNotFoundError`, `UserAlreadyExistsError`, `PermissionNotFoundError`, `RoleAlreadyExistsError`,
  `FollowAlreadyExistsError`, `FollowCannotFollowYourselfError`, `ConversationNotFoundError`, etc.
- Each maps to a stable HTTP status (`404`, `409`, `400`, …).
- Central error handler converts domain errors → JSON `{ message, code }` responses.

### 5.9 Auth

- **JWT access + refresh tokens** (`generateTokens`, `refreshToken`).
- `requireAuth()` guard for protected handlers; `isPublic` marker for public routes
  (replaces `@Public()` + `AuthGuard`).
- `getCurrentUser()` helper (replaces `InjectAccessTokenPayload`).
- Password hashing via `bcrypt` (salt rounds 10) — central `hashPassword` / `comparePasswords` utils.
- **OAuth** (Google + GitHub) → verify id token/access token → upsert user → issue tokens.
- **Password reset**: sign reset token, email link, verify-token endpoint.
- Token payload: `{ sub, email, iat, exp }` (replaces `AccessTokenPayload`).

### 5.10 Audit logging

- Replicate the `@LogEvent(EventType.X)` + interceptor pattern: an `EventType` enum, and a
  mechanism to record `{ event, userId, method, api, logInfo }` for mutating endpoints
  (e.g. `USER_CREATE`, `USER_UPDATE`, `SIGNIN`).

### 5.11 Storage (provider pattern)

- Abstract `StorageService` with: `store`, `storeMultipleFiles`, `loadResource`, `duplicate`,
  `delete`, `confirm`, `expose/hide`, `findTemporary`, `cleanTemporary` (scheduled cleanup).
- Implement `LocalStorageService` and `S3StorageService`; select via a `STORAGE_DRIVER` env var
  (replaces `storageProvider` factory).
- Track `isTemporary` / `isPrivate` flags; cron-like cleanup of temporary uploads.

### 5.12 Config & env validation

- Group config into namespaces: `app`, `database`, `doc` (OpenAPI), `storage` (s3).
- Validate env with **Zod** at boot; throw a clear error on invalid/missing vars
  (replaces `validate-config.ts` + `class-validator` env classes).
- Ship a documented `.env.example`.

### 5.13 Seeders & migrations

- SQL migrations (versioned, checksummed) run automatically at startup.
- CLI-driven **seeders** (permissions, roles, admin user, reference types, templates,
  configuration) with deterministic idempotent data — mirror `instanct-api/src/seeders/**`.
- Provide a `seed:*` script per domain.

---

## 6. Frontend Architecture

### 6.1 App Router structure

- `(auth)` group for public pages; `(dashboard)` group wrapped in an authenticated shell layout.
- Server Components by default; `"use client"` only where interactivity/state is needed.
- Route protection: a `(dashboard)/layout.tsx` that redirects unauthenticated users to `/login`,
  and redirects authenticated users away from auth pages (replicates `Application.tsx`).

### 6.2 API client (replicates `instanct-ui/src/api`)

- A single Axios instance (`lib/api/client.ts`) with:
  - `baseURL` from `NEXT_PUBLIC_BASE_URL` (client) / `BASE_URL` (server)
  - Request interceptor: inject `x-custom-lang` (from locale) and `Authorization: Bearer <token>`
  - Response interceptor: on `401`, attempt refresh-token once, retry, else logout
- Organize endpoints by domain in `lib/api/*` with a barrel `api` object
  (`api.admin.user.findPaginated(...)`, `api.auth.signIn(...)`), exactly like `instanct-ui/src/api`.

### 6.3 Data fetching (TanStack Query)

- One hook per query under `hooks/content/<domain>/`, e.g. `useUsers`, `useUser`, `useRoles`.
- Use `queryKey` arrays (`["user", email]`), `enabled` flags, and return
  `{ data, isFetching, refetch }` (replicates `useEmailUser.ts`).

### 6.4 Client state (Zustand)

- One store per concern under `hooks/stores/` (e.g. `useAuthStore` with `persist`,
  `useUserStore` for form/dto state, feature stores).
- Auth tokens persist to storage and sync from the NextAuth session via a small
  `AuthTokenSync` component (replicates `instanct-ui`).

### 6.5 Types (mirror backend DTOs)

Under `types/`, reproduce:
- `DatabaseEntity` base (`createdAt`, `updatedAt`, `deletedAt`, `isDeletionRestricted`)
- `Response*`, `Create*`, `Update*` interfaces per entity
- `Paginated<T>` + `PageMeta`, `QueryParams`, `ServerResponse<T>`, `ServerErrorResponse`
- `*Response extends *AbstractResponse extends DatabaseEntity` inheritance exactly as the backend
- Export everything from `types/index.ts` barrel

### 6.6 UI design system

- shadcn/ui `new-york` style, `neutral` base, CSS variables in `styles/globals.css`.
- Every primitive uses `cn(…)` from `lib/utils.ts` and `cva` for variants
  (replicate `button.tsx` exactly).
- Theme via `next-themes` (default dark, system fallback).

### 6.7 Declarative FormBuilder (replicate exactly)

- `FormStructure` → `Fieldset[]` → `FieldsetRow[]` → `Field[]`.
- `FieldVariant` enum: `text, email, tel, number, url, password, date, select, multi_select,
  checkbox, check, radio, switch, textarea, image, image_gallery, file, empty, custom`.
- `FieldBuilder` switch renders the correct primitive per variant.
- Forms are declared as `useXxxFormStructure()` hooks, not JSX-hardcoded (as in
  `useCreateUserFormStructure.tsx`).

### 6.8 DataTable (replicate)

- Reusable `DataTable<TData, TValue>` wrapping `@tanstack/react-table` with:
  sorting, filtering, row selection, column visibility, faceted values, pagination.
- Column definitions in a `columns.tsx` per feature; toolbar + view-options + pagination subcomponents.

### 6.9 Layout & navigation

- Shell = `Sidebar + Header + PageHeader + <main> + Footer`, with contexts for
  Breadcrumb, Intro (title/description/floating actions), and Footer content
  (replicates `instanct-ui/src/components/layout`).

### 6.10 i18n

- Multi-locale with namespaced JSON resources (default `en`, plus `fr`).
- Central `i18n` config; `useTranslation()` in components; language switcher.

---

## 7. Design & UX Principles (from `instanct-ui` / `instanct-mobile-app`)

- **Skeleton loaders** for every async list/card (perceived performance).
- **Empty states** with icon + message (e.g. `PackageOpen` + "No results").
- **Loading states** in tables (spinner row) and buttons.
- Consistent **error display** inline under form fields + toast (`sonner`).
- Responsive grids (1/2/3/4 columns by breakpoint) for forms and cards.
- Consistent **soft-delete-first** UX: destructive actions use confirm dialogs/sheets.

---

## 8. Clean-Code Conventions

- **Strict TypeScript**; no `any` (use `unknown` + narrowing; explicit `// eslint-disable` only when justified).
- **File-per-class** for backend layers; **kebab-case** filenames for components, `camelCase` for hooks/utilities.
- **Barrel exports** (`index.ts`) per folder/domain; a top-level `types/index.ts`.
- **Absolute imports** via `@/*` path alias.
- **Single responsibility**: controllers thin, services orchestrate, repositories only data.
- **Naming**: `Response*`, `Create*`, `Update*` DTOs; `use*` hooks; `*Service`, `*Repository`,
  `*Controller`; `*NotFoundError`, `*AlreadyExistsError`.
- **Reuse over duplication**: prefer the abstract repository/CRUD service and the shared
  QueryBuilder; do not re-implement CRUD per entity.
- **Transactions** around every multi-step write; atomic association sync via diff utilities.
- **No secrets** in client code; only `NEXT_PUBLIC_*` reach the browser.
- **Prettier** (`singleQuote`, `trailingComma: all`) + **ESLint** enforced on commit.

---

## 9. Docker & CI/CD (replicate)

- **Docker**: multi-stage build (node builder → distroless runtime), `--frozen-lockfile`,
  pass `NEXT_PUBLIC_*` as build args, copy only `.next`, `public`, `node_modules`, `package.json`.
- **GitHub Actions**: on push to `main`, build image → save archive → SCP to server → SSH
  `docker load` + run with `--env-file` (replicates `deploy-test.yml`).
- Provide `.env.example`, `.dockerignore`, `.gitignore`.

---

## 10. Deliverables / Acceptance Criteria

Produce a working skeleton that includes, at minimum:

1. Bootstrapped Next.js App Router + strict TS + ESLint + Prettier + Tailwind + shadcn/ui.
2. `server/shared/database` with generic `AbstractRepository`, `AbstractCrudService`, pagination,
   and the query DSL.
3. At least **one fully-wired feature module** (e.g. `users`) demonstrating the full
   `route → controller → service → repository → schema/serializer → errors` flow, including
   list pagination, get-by-id, create, update, soft-delete.
4. Auth module: sign-in (credentials), refresh-token, OAuth (Google/GitHub), password reset.
5. Storage provider pattern (local + S3) and mail service.
6. Frontend: typed API client + interceptors, TanStack Query hooks, Zustand auth store, protected
   shell layout, login page, a users list page using the DataTable, and a create/edit form using the
   FormBuilder.
7. `.env.example`, seeders, migrations, Dockerfile, and CI/CD workflow.

Write code that is **production-quality, convention-consistent, and generic/reusable** — do not
hard-code domain logic into shared infrastructure.

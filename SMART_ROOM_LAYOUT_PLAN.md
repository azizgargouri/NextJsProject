# Smart Room Layout — Omar's feature plan

**Owner:** Omar Degani · **Branch:** `smart-room` · **Started:** 2026-11-04

The client describes their **new house** (rooms, sizes, doors, windows). The platform reads the
items from their **move request** and an **AI model suggests where each item goes** in the new
house. The client can review, edit and regenerate the plan.

```
Move request items (static for now) ─┐
                                     ├─► AI (Ollama → Groq fallback) ─► code checks ─► LayoutPlan ─► SVG floor view
New house + rooms (CRUD) ────────────┘
```

---

## Ground rules

1. **No edits to teammates' files.** Everything lives in new files that belong to this feature.
   Shared barrels (`types/index.ts`, `lib/api/index.ts`, `server/shared/database/models/index.ts`,
   `server/seed.ts`, `server/config/env.ts`, `package.json`) are **not touched**. Feature code
   imports its own files directly. **One agreed exception:** two lines in
   `app/(dashboard)/dashboard/page.tsx` (import + `<HomesDashboardEntry />`) so clients can reach
   the feature after signing in.
2. **The move-request flow belongs to another member** (branch `requests-and-inventory`). Until it
   is merged we use **static request data** with the exact same item shape their `Move` model
   uses: `{ id, name, volume, weight, quantity }`.
3. **AI = local Ollama first, Groq as fallback.** No paid Claude/OpenAI SDK. Calls use plain
   `fetch` with a JSON schema, so no new npm dependency is needed.
4. **Same structure as the project:** `route.ts` (thin) → controller → service → repository →
   Mongoose model, Zod schemas, whitelisted serializers, React Query hooks, Axios API client,
   feature components under `components/features/`. Client pages use the public **Swiss Industrial
   Print** style already used by `/dashboard` (paper, ink, hazard red, mono labels, no radius).
5. Every step ends with **verification by me** (typecheck, lint, API calls, browser check) and
   then **a test by you** before the next step starts.

---

## Environment

| Variable            | Value                            | Used for                                                   |
| ------------------- | -------------------------------- | ---------------------------------------------------------- |
| `OLLAMA_BASE_URL`   | `http://localhost:11434`         | Local AI server                                            |
| `OLLAMA_MODEL`      | `qwen3.5:4b-q4_K_M`              | Fast local model with JSON-schema output (~6 s per answer) |
| `OLLAMA_TIMEOUT_MS` | `90000`                          | After this, switch to Groq                                 |
| `GROQ_API_KEY`      | in `.env` only (never committed) | Fallback AI                                                |
| `GROQ_MODEL`        | `openai/gpt-oss-120b`            | Fallback model available on this Groq account              |

Other installed Ollama models you can switch to: `gemma4:12b` (slower, smarter), `llama3.1:latest`.

**Test accounts**

| Role               | Email                   | Password      |
| ------------------ | ----------------------- | ------------- |
| Omar's test client | `omar.client@moveup.tn` | `Demo#2026!`  |
| Demo client        | `client@moveup.tn`      | `Demo#2026!`  |
| Admin              | `admin@moveup.tn`       | `Admin#2026!` |

**Commands**

```bash
yarn db:seed && yarn tsx server/seeds/smart-layout.seed.ts   # demo accounts + Omar's client
yarn dev                                                      # http://localhost:3000
npx tsc --noEmit && yarn lint                                 # typecheck + lint
```

---

## File map (all new files)

```
server/shared/database/models/home.model.ts         Home + embedded rooms/openings
server/shared/database/models/layout-plan.model.ts  Saved AI plans                    (step 3)
server/modules/homes/                               schema · repository · service · serializer · controller
server/modules/room-layout/                         static request · sizes · checker · AI providers · service   (steps 2–3)
server/seeds/smart-layout.seed.ts                   Omar's test client
app/api/homes/...                                   REST routes
app/(dashboard)/dashboard/homes/...                 Client pages
components/features/homes/...                       UI
hooks/content/homes/...                             React Query hooks
lib/api/homes.ts                                    Axios endpoints
types/homes.ts                                      DTO types
```

---

## Steps

### Step 0 — Preparation ✅

- `.env` created (with the Ollama + Groq variables above). `.env` is git-ignored.
- Packages installed, demo accounts seeded, Omar's test client created.
- Ollama and Groq both checked: each returns valid JSON.

**You test:** sign in at `/sign-in` with `omar.client@moveup.tn` / `Demo#2026!` → you land on `/dashboard`.

---

### Step 1 — New house & rooms CRUD ✅ (waiting for your test)

**Backend**

- `Home` model: `clientId`, `label`, `city`, `type` (APARTMENT / VILLA / STUDIO / DUPLEX), `floor`,
  `hasElevator`, `notes`, `rooms[]`, `deletedAt` (soft delete).
- Room: `name`, `type` (LIVING / BEDROOM / KITCHEN / BATHROOM / DINING / OFFICE / KIDS / STORAGE /
  BALCONY / OTHER), `widthCm` (west→east), `lengthCm` (north→south), `notes`, `openings[]`.
- Opening: `kind` (DOOR / WINDOW), `wall` (N / E / S / W), `offsetCm` (from the wall's start
  corner: west corner for N/S walls, north corner for E/W walls), `widthCm`.
- Rules: only the owner (CLIENT role) can see or change a house; an opening must fit inside its
  wall; max 10 houses per client, 20 rooms per house, 8 openings per room.

| Method | Route                             | Action               |
| ------ | --------------------------------- | -------------------- |
| GET    | `/api/homes?page=&limit=&search=` | List my houses       |
| POST   | `/api/homes`                      | Create a house       |
| GET    | `/api/homes/[id]`                 | One house with rooms |
| PATCH  | `/api/homes/[id]`                 | Update house info    |
| DELETE | `/api/homes/[id]`                 | Soft delete          |
| POST   | `/api/homes/[id]/rooms`           | Add a room           |
| PATCH  | `/api/homes/[id]/rooms/[roomId]`  | Update a room        |
| DELETE | `/api/homes/[id]/rooms/[roomId]`  | Remove a room        |

**Frontend**

- `/dashboard/homes`: house cards, search, empty and loading states.
- `/dashboard/homes/new`: create form.
- `/dashboard/homes/[id]`: house info (edit/delete) + rooms list with a small top-down outline
  drawn to scale (doors + swing in hazard red, windows as a double line), add/edit/delete room
  with a live preview. Deletes ask for confirmation.
- **Dashboard entry** (`homes-dashboard-entry.tsx`): after sign-in, a CLIENT sees a
  "My new house" block under the workspace cards with **Add a house**, **My houses**, and the 3
  most recent houses. Movers and admins don't see it (and it makes no API call for them).
- React Query keys for houses include the signed-in user's id, because sign-out does not clear
  the cache: a second account on the same browser never sees the first account's houses.

**Verified by me (2026-11-04):** `tsc` + `eslint` clean · 16/16 API checks
(`create/read/update/delete`, 422 validation, door-doesn't-fit rule, other client → 404,
mover → 403, no token → 401, bad id → 400) · browser: create → add room → edit room →
delete room → edit house → delete house, no console errors · 375 px phone width, no sideways scroll.
Fixed during verification: grids with fewer cards than columns showed black empty cells.

**You test:** create a house, add 3 rooms with doors/windows, edit one, delete one, delete the house.
Sign in as `client@moveup.tn` and confirm you **cannot** see Omar's houses.

---

### Step 2 — Connect the (static) move request + item sizes

- `server/modules/room-layout/static-move-request.ts`: 2 demo requests (e.g. `MU-2026-DEMO01`
  apartment move, `MU-2026-DEMO02` studio move) with the teammate's item shape
  (`id, name, volume, weight, quantity`), owned by Omar's test client.
- `furniture-sizes.ts`: footprint table per catalogue id (bed 160×200, sofa 200×90, fridge 60×65,
  washer 60×60, table 160×90, chair 50×50, box 50×35…). Unknown items get a footprint from their volume.
- A house can be linked to one request (`moveReference` field, PATCH house).
- House page shows **"Items coming to this house"** with quantity and footprint.

**You test:** link a house to `MU-2026-DEMO01`, see the item list with sizes, unlink it.

---

### Step 3 — AI layout generation (Ollama → Groq) + checks

- `ai/ollama.provider.ts`: `POST /api/chat` with `format: <JSON schema>`, `think: false`, timeout.
- `ai/groq.provider.ts`: OpenAI-compatible `chat/completions` with `response_format: json_schema`.
- `layout-ai.ts`: try Ollama → on timeout / error / invalid JSON, try Groq → otherwise fail cleanly.
  The JSON schema comes from Zod (`z.toJSONSchema`), and the answer is validated with the same Zod schema.
- `layout-checker.ts` (pure functions + a small test): each item inside its room, no overlap,
  nothing blocking a door's swing area. Bad placements become **warnings**, never silent.
- `LayoutPlan` model: `homeId`, `clientId`, `moveReference`, `status` (READY / FAILED),
  `provider` (ollama / groq), `model`, `placements[]` (itemId, unit, roomId, x, y, rotated, reason),
  `unplaced[]`, `warnings[]`, `tips[]`, `inputHash`.
- Routes: `POST /api/homes/[id]/layout` (generate), `GET` (latest plan), `PATCH` (move or rotate one item), `DELETE`.

**You test:** press **Suggest layout**, see placements and which AI answered. Stop Ollama
(`ollama stop` / quit the app) and press again → Groq answers.

---

### Step 4 — Layout view

- `/dashboard/homes/[id]/layout`: each room drawn to scale as SVG (walls, door gaps, windows,
  item rectangles + labels), item list with the AI's reason, unplaced items, warnings, tips.
- Actions: move an item to another room, rotate it, regenerate, delete the plan.

**You test:** generate → read the drawing → move the sofa to another room → regenerate → delete.

---

### Step 5 — Hardening & hand-off

- Same input → saved plan returned (no new AI call); max 10 generations per house per day.
- Honest errors when both AI providers are down; mobile layout check.
- `npx tsc --noEmit`, `yarn lint`, `yarn build` all green.
- Merge notes for the team:
  - swap `static-move-request.ts` for the real `Move` model when `requests-and-inventory` lands;
  - **dashboard entry moves:** on `requests-and-inventory` / `rh-and-employee-tracking`,
    `/dashboard` becomes an admin-only HR page and clients are redirected to `/request`. When those
    merge, keep their version of `app/(dashboard)/dashboard/page.tsx` and instead add
    `{ href: '/dashboard/homes', label: 'My new house' }` to the client nav in their
    `dashboard-shell.tsx` (or render `<HomesDashboardEntry />` on the client landing). The
    `/dashboard/homes` pages keep working because they don't use `adminOnly`;
  - optionally export the types/API from the shared barrels;
  - suggest to the auth owner: clear the React Query cache on sign-out (`queryClient.clear()`).

**You test:** full flow end to end, then we open a PR.

---

## Progress log

| Step                       | Status  | Verified by me | Tested by you |
| -------------------------- | ------- | -------------- | ------------- |
| 0 — Preparation            | ✅ done | ✅             | ⏳            |
| 1 — House & rooms CRUD     | ✅ done | ✅             | ⏳            |
| 2 — Static request + sizes |         |                |               |
| 3 — AI generation          |         |                |               |
| 4 — Layout view            |         |                |               |
| 5 — Hardening & hand-off   |         |                |               |

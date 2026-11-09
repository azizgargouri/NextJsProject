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

| Variable            | Value                            | Used for                                                                |
| ------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| `OLLAMA_BASE_URL`   | `http://localhost:11434`         | Local AI server                                                         |
| `OLLAMA_MODEL`      | `qwen3.5:4b-q4_K_M`              | Local text model for planning — **not installed right now** (see below) |
| `OLLAMA_TIMEOUT_MS` | `90000`                          | After this, switch to Groq                                              |
| `GROQ_API_KEY`      | in `.env` only (never committed) | Fallback AI                                                             |
| `GROQ_MODEL`        | `openai/gpt-oss-120b`            | Fallback model available on this Groq account                           |

**Photo model:** `x/flux2-klein` is downloaded, but Ollama 0.40.14 refuses image models in the API
and in the terminal (`image generation models are not currently supported`), so it is **not
wired in**. Re-test with `ollama run x/flux2-klein "a bedroom"` after an Ollama update.

**Ollama status (2026-11-04):** the old text models were removed to free disk space, and only
`x/flux2-klein` (image generation, can't plan layouts) is installed. Decision: **Groq only for
now** — every plan records "Ollama skipped: model … not found" and Groq answers in ~2 s. To turn
Ollama-first back on, install a text model (no code change):

```bash
ollama pull qwen3.5:4b-q4_K_M
```

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
yarn tsx server/modules/room-layout/furniture-sizes.check.ts  # furniture size self-check
```

> After changing a Mongoose schema (e.g. adding a field), **restart `yarn dev`**: the dev server
> keeps the old compiled model (`models.Home ?? model(...)`) and silently drops the new field.

---

## File map (all new files)

```
server/shared/database/models/home.model.ts         Home + embedded rooms/openings
server/shared/database/models/layout-plan.model.ts  Saved AI plans (one per house)
server/modules/homes/                               schema · repository · service · serializer · controller
server/modules/room-layout/                         static requests · sizes · move-requests service (step 2) · checker · AI (step 3)
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

### Step 1 — New house & rooms CRUD ✅ (tested by you, pushed to `smart-room`)

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

### Step 2 — Connect the (static) move request + item sizes ✅ (tested by you)

**Backend** (`server/modules/room-layout/`)

- `move-requests.service.ts` — reads the client's real `Move`s (`clientId`), newest first.
  `moveDate` is the day picked at booking (older moves fall back to `createdAt`).
  Demo moves are seeded by `yarn db:seed`:

  | Reference        | Owner                   | Route                    | Items |
  | ---------------- | ----------------------- | ------------------------ | ----- |
  | `MU-2026-DEMO01` | `omar.client@moveup.tn` | Les Berges du Lac → Sfax | 37    |
  | `MU-2026-DEMO02` | `omar.client@moveup.tn` | Ariana → Tunis           | 14    |

  `client@moveup.tn` gets the live move `MU-2026-004281`.

- `furniture-sizes.ts` — floor footprint per catalogue id (bed 160×200, sofa 200×90, wardrobe
  120×60, table 160×90, desk 120×60, TV stand 150×40, fridge 60×65, washer 60×60, chair 50×50,
  box 50×35). Unknown ids (e.g. the load scanner's `scan-7f3a` bookshelf) are **estimated** from
  volume as a 1 m tall square block, 30–250 cm per side. Boxes count in stacks of 3.
  Self-check: `furniture-sizes.check.ts`.
- `move-requests.service.ts` — `listForClient`, `findForClient`, `expand` (items + footprints + totals).
- `Home.moveReference` (nullable). Rules: the request must be the client's own (else 404), and one
  request links to one house (else 409 "already linked to …"). Deleting a house frees its request.
- Every single-house response (GET + all mutations) now includes `moveRequest` with items,
  footprints and totals; the list only carries `moveReference`.

| Method | Route                      | Action                                                        |
| ------ | -------------------------- | ------------------------------------------------------------- |
| GET    | `/api/homes/move-requests` | My move requests + which house each is linked to              |
| PATCH  | `/api/homes/[id]`          | `{ "moveReference": "MU-2026-DEMO01" }` links, `null` unlinks |

**Frontend**

- House page → **"Moving in."** panel: pick a request (requests linked to another house are
  disabled), then totals (items, volume, weight, floor needed), a fit hint comparing the floor
  needed with the rooms' total area (Comfortable ≤ 40 % < Tight ≤ 60 % < Very tight), and the item
  table (qty, size each, floor, catalogue/estimated). **Change request** and **Unlink**.
- House list cards show the linked request.

**Verified by me (2026-11-04):** 15/15 step-2 API checks (own requests only, mover 403, link,
409 double link, 404 someone else's / unknown request, link survives room edits, relink, unlink,
delete frees the request) · 16/16 step-1 API checks still green · size self-check · `tsc` +
`eslint` clean · browser: link → totals + table → change to DEMO02 → unlink, list card shows the
reference · 375 px: page fits, only the table scrolls sideways.

**Bug found and fixed (from step 1):** with Zod 4, `HomeCreateSchema.partial()` kept the
defaults, so any PATCH that didn't send `floor` / `hasElevator` / `notes` reset them to
`0` / `false` / `''`. The edit form always sends every field, so step 1's UI never showed it;
the link button did. `HomeUpdateSchema` is now built from fields without defaults, and the API
checks include a regression test.

**You test:** open your house → **Moving in.** → link `MU-2026-DEMO01` → check the item list,
sizes and fit hint → **Change request** to `DEMO02` → **Unlink**. Then sign in as
`client@moveup.tn`: only `MU-2026-DEMO03` is offered there.

---

### Step 3 — AI layout + to-scale drawing ✅ (tested by you)

**Decision (2026-11-04): "AI plans, the app draws."** Groq has no image models and the installed
Ollama image model can't respect real sizes, so the AI chooses **room + wall + reason** for every
item and MoveUp computes exact positions and draws each room to scale. A photo-style render with
`x/flux2-klein` can come later as an extra.

**Backend** (`server/modules/room-layout/`)

- `ai/ai.config.ts` — reads `OLLAMA_*` / `GROQ_*` (empty value = provider skipped).
- `ai/layout-prompt.ts` — Zod answer schema → JSON Schema (`z.toJSONSchema`) for both providers;
  prompt rules (beds in bedrooms, sofa facing TV, fridge in kitchen, table + chairs together,
  boxes in storage/largest room, avoid door walls, wall-only items never CENTER). Rooms are sent
  as short keys `R1, R2…` — models mis-copied 24-char Mongo ids, which dropped items.
- `ai/providers.ts` — Ollama `/api/chat` (`format`, `think: false`, timeout) and Groq
  `chat/completions` (`response_format: json_schema`, `strict`, `reasoning_effort: low`). Plain
  `fetch`, no new dependency, key-free error messages.
- `ai/layout-ai.ts` — Ollama → Groq → 503 `LAYOUT_AI_UNAVAILABLE`; every attempt is recorded.
- `layout-packer.ts` (+ `layout-packer.check.ts`) — exact positions: inside the room, no
  overlaps (5 cm gap), door swings kept free, tall items (fridge, wardrobe, bookshelf) never in
  front of windows, wall-only items never free-standing, full walls → next wall → centre, items
  that don't fit are listed with the reason. An item with no usable AI room gets one from MoveUp
  (flagged).
- `layout.service.ts` — units (one per item, boxes in stacks of 3), AI call, packing, one saved
  plan per house, `stale` flag when rooms/doors/windows/items change after the plan.
- `LayoutPlan` model (`server/shared/database/models/layout-plan.model.ts`).

| Method | Route                    | Action                                     |
| ------ | ------------------------ | ------------------------------------------ |
| POST   | `/api/homes/[id]/layout` | Generate (or regenerate) the plan          |
| GET    | `/api/homes/[id]/layout` | Saved plan + `stale` (404 when none)       |
| DELETE | `/api/homes/[id]/layout` | Delete the plan (house, rooms, items stay) |

**Frontend** — house page → **"Layout."** section (after Rooms): Suggest layout / Regenerate /
Delete plan, live "Planning… Ns" status, "Planned by Groq (cloud) · model · 2.1 s" + why Ollama
was skipped, stale banner, every room drawn to scale with numbered items flush against the walls,
numbered list with wall + the AI's reason, items that could not be placed, move-in tips.

**Verified by me (2026-11-04):** 11/11 step-3 API checks (400 without request, 404 before
generate, generate 2–3 s via Groq, 0 overlaps, stale after a room edit, other client 404, mover
403, delete + 404 after) · AI fallback paths: Ollama not running / image-only model / timeout /
not configured → Groq answers; both failing → clear 503 without leaking the key · packer and size
self-checks · step-1 API checks still green · `tsc` + `eslint` clean · browser: generate →
drawings + list + tips, regenerate, no console errors.
Fixed during verification: duplicate React keys on identical warnings; walls now drawn over the
furniture so items sit flush against them; long Mongo room ids replaced by `R1…` keys.

**You test:** open your house → make sure a request is linked and rooms exist → **Layout.** →
**Suggest layout** → read the drawings and reasons → edit a room (the plan shows "changed") →
**Regenerate** → **Delete plan**.

---

### Step 4 — Edit the layout + drag and drop ✅ (tested by you)

**Backend**

- `layout-packer.ts` — new `placeUnit(room, unit, wall, taken, { orientations, near })`: the
  single-item placement the full packer now uses too, so manual edits follow the same rules
  (inside the room, no overlap, door swings free, tall items off windows). `near` keeps an item
  close to where it was (turning in place). Placements now store `rotated`.
- `layout.schema.ts` — one change per request:
  `{ action: 'move', unitId, roomId, wall }` (also places a left-out item),
  `{ action: 'rotate', unitId }`, `{ action: 'remove', unitId }`.
- `layout.service.ts#updateItem` — 409 `LAYOUT_NO_SPACE` with a plain sentence when the spot is
  full, 409 `LAYOUT_ITEM_GONE` when the item left the request, 404 unknown room / no plan, 400
  rotating an item that is not placed. An edited item keeps its position in the list (its number
  stays) and is marked `source: 'client'`; taken-out items stay in `unplaced` with
  `removedByClient`. `manualChanges` counts them.

| Method | Route                    | Action                                      |
| ------ | ------------------------ | ------------------------------------------- |
| PATCH  | `/api/homes/[id]/layout` | Move / turn 90° / take out / place one item |

**Frontend**

- `furniture-symbol.tsx` — top-down drawings: bed (pillows + blanket fold), sofa (backrest,
  arms, cushions), chair, table, desk, fridge, washer (drum), wardrobe (rail + doors),
  bookshelf, TV stand, box stack (×). Each faces the wall it stands on; a turned item's back
  faces the next wall (a turned bed's headboard is on its short end). Unknown items stay plain.
- Click an item in the drawing or its row in the list → editor under the room: Room, Position
  (north/east/south/west wall, free-standing), **Move here**, **Turn 90°**, **Take out**; errors
  shown in place; Esc / × closes. The selected item is highlighted in hazard red.
- "Not in the layout" box: **Place it** for items that did not fit or were taken out.
- **Regenerate** asks first when there are manual changes ("replace your 2 manual changes").
- Meta line shows "N changes by you"; rows show "Moved by you" and "turned".

**Drag and drop (added on request)**

- Grab any item in a room drawing (or the dashed handle of an item that is "Not in the layout")
  and drag it — inside its room or into another room's drawing. While dragging, the spot is
  snapped to a 5 cm grid and pulled flush to a wall within 15 cm, then checked with the same
  rules as the server: **green ghost + green room border** = free spot, **red** = not allowed
  with the reason (blocks the door, too close to the sofa, too tall for a window, outside the
  room). A status bar at the bottom of the screen says the same in words. **R** turns the item
  while dragging, **Esc** cancels. Dropping on red changes nothing; dropping on green saves.
- A plain click still opens the editor (the click that ends a drag is ignored).
- Server: new action `{ action: 'place', unitId, roomId, x, y, w, h }` re-checked with
  `spotProblem()`; the wall / turned flag are worked out with `describeSpot()` (both in
  `layout-packer.ts`, covered by the self-check). Client mirror of the rules:
  `components/features/homes/layout-geometry.ts`; drag logic: `use-layout-drag.ts`.
- Verified: 10/10 drag API checks (exact free spot, turned on a wall, too close, door, tall item
  at window, outside, wrong size 422, other client 404) · browser: real mouse drag bed bedroom →
  living room, red over the door and refused drop with the reason, R turns the ghost
  160×200 → 200×160, Esc cancels, click still opens the editor, dragging a left-out chair from
  the list into the office · 375 px fits, `touch-action: none` on items, no console errors.
  Fixed during verification: a very fast click was lost (selection now uses the normal click).

**Verified by me (2026-11-04):** 14/14 step-4 API checks (edit before plan 404, move keeps the
number, rotate 160×200 → 200×160 on the same wall, full room 409 with a clear sentence, take
out → `removedByClient`, rotate a taken-out item 400, place it back, bad action 422, unknown
item 409, unknown room 404, other client 404, mover 403, 0 overlaps after edits) · step-3 (11)
and step-1 (16) API checks still green · packer self-check with place / rotate / full-wall /
near cases · `tsc` + `eslint` + prettier clean · browser: furniture drawings, select bed →
turn → move to the living room's west wall → take a chair out → place it back → regenerate
warning → regenerate clears manual changes · 375 px: page fits, editor stacks, no errors.
Fixed during verification: a turned bed drew its pillows along the wall; long position labels
were cut off in the select.

**You test:** open your house → **Layout.** → **drag** the sofa to another room (watch green/red,
press R while dragging) → drop it on red once (nothing changes) and on green → click the bed →
**Turn 90°** → take a chair out and drag it back from "Not in the layout" → **Regenerate** (you
get the warning) → **Delete plan**.

---

### Installable app (PWA) + offline

- On `unified-all-features` the app uses the **team's PWA** (`app/manifest.ts`, `public/sw.js`,
  `components/pwa-register.tsx`). Its worker caches pages and static files but **never `/api/*`**
  (private data), so the homes pages open offline without their house data.
- The homes queries keep `networkMode: 'offlineFirst'`, so per-user `/api/homes*` caching can be
  added to the team's `sw.js` later without touching the hooks. (`smart-room` keeps the original
  homes-data cache in its own `sw.js`.)

---

### Step 5 — Hardening & hand-off

- Same input → saved plan returned (no new AI call); max 10 generations per house per day.
- Honest errors when both AI providers are down; mobile layout check.
- `npx tsc --noEmit`, `yarn lint`, `yarn build` all green.
- Merge notes for the team:
  - ✅ static move requests swapped for the real `Move` model (unified-all-features);
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
| 0 — Preparation            | ✅ done | ✅             | ✅            |
| 1 — House & rooms CRUD     | ✅ done | ✅             | ✅            |
| 2 — Static request + sizes | ✅ done | ✅             | ✅            |
| 3 — AI layout + drawing    | ✅ done | ✅             | ✅            |
| 4 — Edit + drag and drop   | ✅ done | ✅             | ✅            |
| 5 — Hardening & hand-off   |         |                |               |

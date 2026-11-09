# Mover side: what was built and how it fits together

This page explains the work on the `mover-side` branch (merged into `dev` on 2026-11-09, see [INTEGRATION.md](INTEGRATION.md)) for anyone joining the project or connecting their part to it. It covers what each feature does, where the code is, the decisions behind it, and what the rest of the app still needs to provide.

Related docs: [OFFLINE.md](OFFLINE.md) (running without internet), [DESIGN.md](DESIGN.md) (visual rules), [PRODUCT.md](PRODUCT.md) (product spec).

## Contents

1. [Quick start](#1-quick-start)
2. [Box scanning at pickup](#2-box-scanning-at-pickup)
3. [Profitability estimate on offers](#3-profitability-estimate-on-offers)
4. [The duration model (the AI part)](#4-the-duration-model-the-ai-part)
5. [Real data only](#5-real-data-only)
6. [Offline mode and phones](#6-offline-mode-and-phones)
7. [Database changes](#7-database-changes)
8. [How other parts connect to the mover side](#8-how-other-parts-connect-to-the-mover-side)
9. [Known gaps and audit findings](#9-known-gaps-and-audit-findings)
10. [Tests and checks](#10-tests-and-checks)

---

## 1. Quick start

```bash
yarn install
yarn db:seed        # demo accounts, pricing rule, landing copy
yarn dev            # http://localhost:3000
```

Or, with no internet at all (see [OFFLINE.md](OFFLINE.md)):

```bash
yarn offline
```

**Demo accounts** (created by `server/seed.ts`, for development only):

| Role   | Email                        | Password                        |
| ------ | ---------------------------- | ------------------------------- |
| Admin  | `SEED_ADMIN_EMAIL` in `.env` | `SEED_ADMIN_PASSWORD` in `.env` |
| Client | `client@moveup.tn`           | `Demo#2026!`                    |
| Mover  | `mover@moveup.tn`            | `Demo#2026!`                    |

The mover workspace starts empty. A mover only gets offers once a move is submitted and dispatched to them (see [section 8](#8-how-other-parts-connect-to-the-mover-side)), and once their profile has valid insurance, at least one zone and available days.

**Other commands:**

| Command           | What it does                                           |
| ----------------- | ------------------------------------------------------ |
| `yarn test:mover` | Runs the mover tests (150) against `TEST_MONGODB_URI`  |
| `yarn ai:train`   | Trains the duration model now and prints its accuracy  |
| `yarn offline`    | Builds and runs the whole app locally with no internet |

---

## 2. Box scanning at pickup

**The problem it solves:** knowing exactly how many boxes went into the van, so nothing is lost or disputed later.

**How it works for the mover:**

1. Before the move, the mover can print a sheet of QR labels for the job from the job page (**Print labels**, `/mover/jobs/[id]/labels`). Up to 200 labels per sheet, with a chosen first box number.
2. At the pickup house, once the job is in the **Loading** step, the mover scans each box as it goes into the van:
   - **live camera** (needs https or localhost),
   - **photo of a label** (works over plain http, for example from a phone on the office Wi-Fi),
   - or **typing the code** under the label.
3. Each scan adds the box to a list on screen. The same box can't be counted twice, and a scan can be removed if it was a mistake.
4. When confirming the load, **the box count is the number of scans**. The mover only types the number of furniture pieces.

Scanning only happens at pickup, during loading. There is no scan at the destination.

**Label format:** `MOVEUP:<move reference>:<box number>`, for example `MOVEUP:MV-2026-12345:004`. Any other QR sticker is accepted too and shown with a shortened label. A MoveUp label from a **different** move is refused ("This label belongs to move X").

**Rules enforced on the server:**

- Scans are only accepted while the job is in progress and in the loading stage.
- At most 500 boxes per move.
- Each code counts once per move (a unique database index).
- Scanning or removing a box after the load was confirmed clears the confirmation, so the counts must be confirmed again.
- Confirming a load with zero boxes and zero furniture is refused.

**Where the code is:**

| Part                      | File                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Label format and parsing  | [lib/box-label.ts](lib/box-label.ts)                                                   |
| Server logic              | [server/modules/mover/mover.boxes.ts](server/modules/mover/mover.boxes.ts)             |
| API                       | `POST /api/mover/jobs/[id]/boxes`, `DELETE /api/mover/jobs/[id]/boxes/[boxId]`         |
| Scanner component         | [components/features/mover/box-scanner.tsx](components/features/mover/box-scanner.tsx) |
| Label sheet               | [components/features/mover/box-labels.tsx](components/features/mover/box-labels.tsx)   |
| Scan list on the job page | `BoxScanPanel` in [jobs-portal.tsx](components/features/mover/jobs-portal.tsx)         |

Scans are sent one at a time, in order, even when the mover scans quickly (React Query mutation `scope`), and pending scans show in the list straight away.

---

## 3. Profitability estimate on offers

**The problem it solves:** a mover sees a price, but not what the job really leaves them after fuel, helpers, wear and commission, or how long it will take. The estimate answers "is this job worth it for me?".

### What movers see

**On each offer card**, a coloured band:

| Band  | Verdict      | Meaning                                                 |
| ----- | ------------ | ------------------------------------------------------- |
| Black | Worth taking | Pays at or above the mover's own hourly target          |
| Grey  | Worth a look | Covers costs, but below the target (at least 60% of it) |
| Red   | Low pay      | Well below the target, or the job loses money           |

The band shows the hourly pay after costs, what the mover keeps, and a meter with a red tick at their target. Jobs that need a quote show a **suggested quote** instead. The offers list can be sorted by **Ending soon** or **Best pay**.

**On the offer page**, an **"Is it worth it?"** panel with:

- the verdict and a one-line explanation,
- three figures: what you keep, per hour, time away,
- the pay meter against the target,
- **Where the money goes**: a bar splitting the price into commission, fuel, helpers, wear and what the mover keeps,
- **Time on the job**: the likely duration, with the possible overrun hatched, and what's left if it runs long,
- **What similar jobs paid** (for quotes, once enough similar jobs are finished),
- numbered reasons and warnings (for example "plan 2 trips" when the load is bigger than the van),
- how confident the estimate is, with a link to the mover's costs.

The quote form opens with the suggested price filled in. The mover can always change it.

**In the profile**, a **My costs** section: fuel use, fuel price, helpers on a usual job, pay per helper, wear per km, and the hourly amount they want to earn.

### How it's calculated

1. **Trip:** base zone (the mover's first zone), to pickup, to destination, and back to base. Distances come from a fixed table between the six zone centres, so it works offline. If the load is bigger than the mover's largest vehicle, extra round trips are added.
2. **Working time:** from the start of loading to delivery. A basic rule estimates it from the volume, items to take apart, fragile items, packing, the drive and any extra trips. The [duration model](#4-the-duration-model-the-ai-part) then corrects it with what finished jobs really took. Floors and elevators are deliberately **not** used.
3. **Money:**

   ```
   fuel     = total km × litres per 100 km / 100 × fuel price
   wear     = total km × cost per km
   helpers  = helpers × hourly rate × hours away
   net      = price − commission − fuel − helpers − wear
   per hour = net ÷ hours away
   ```

   Commission comes from the active pricing rule (15% by default).

4. **Worst case:** the same sums with the 90th-percentile duration.
5. **Suggested quote:** enough to cover the worst-case costs **and** the mover's hourly target, grossed up for commission, rounded to 5 TND.
6. **Similar jobs paid:** the middle half of the final prices of the nearest finished jobs (by volume, distance and rooms). It needs at least 3 similar jobs.

**Default costs** (used until a mover enters their own; **these still need business sign-off**):

| Setting         | Default       |
| --------------- | ------------- |
| Fuel use        | 12 L / 100 km |
| Fuel price      | 2.2 TND / L   |
| Helpers         | 1             |
| Pay per helper  | 8 TND / hour  |
| Wear and upkeep | 0.15 TND / km |
| Hourly target   | 25 TND / hour |

They are in `DEFAULT_MOVER_COSTS` in [mover.constants.ts](server/modules/mover/mover.constants.ts). The zone distances are in [mover.profit.ts](server/modules/mover/mover.profit.ts).

**Still to confirm with the business:** the default costs, the zone distances, and whether movers may see a suggested price.

### Where the code is

| Part                                   | File                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Rules, distances, money, verdict       | [server/modules/mover/mover.profit.ts](server/modules/mover/mover.profit.ts)               |
| Loading costs, model and price history | [server/modules/mover/mover.profitability.ts](server/modules/mover/mover.profitability.ts) |
| Attaching it to offers                 | `joinOffers` in [mover.offers.ts](server/modules/mover/mover.offers.ts)                    |
| Shape sent to the browser              | `ProfitabilityDto` in [types/mover.ts](types/mover.ts)                                     |
| Card band and offer panel              | [components/features/mover/profit-ui.tsx](components/features/mover/profit-ui.tsx)         |
| My costs form                          | `CostsPanel` in [profile-portal.tsx](components/features/mover/profile-portal.tsx)         |

Every offer returned by `GET /api/mover/offers` and `GET /api/mover/offers/[id]` now has a `profitability` field. Costs are saved through the existing profile update (`PATCH /api/mover/profile` with `{ costs }`, or `{ costs: null }` to go back to the defaults).

---

## 4. The duration model (the AI part)

**What it predicts:** how long a job really takes, from the start of loading to delivery. That's the uncertain part of the profit; everything else is known.

**The model:**

```
log(actual hours) = log(basic estimate) + intercept + Σ weight × feature + mover offset
```

- A **ridge regression** learns how wrong the basic rule tends to be, feature by feature: volume, rooms, number of pieces, fragile items, items to take apart, packing, transit distance, afternoon slot, house or villa, extra trips.
- A **per-mover offset** captures each team's pace. It is pulled towards zero until the mover has finished enough jobs, so one fast job doesn't change much.
- The spread of the remaining error gives the **worst case** (90th percentile).
- It's written in plain TypeScript with no extra libraries, trains in milliseconds, and runs inside the app's own server, so it also works offline.

**Training data:** the status events the app already records. Working time is from the first "in progress" event (loading starts) to "delivered". Jobs under 15 minutes or over 16 hours are dropped, since those are almost always forgotten taps.

**When it trains:**

- automatically when a job is delivered, once there are at least **30** clean finished jobs, and again after every **10** more,
- or by hand: `yarn ai:train`.

Only one server trains at a time (a lock document in MongoDB).

**When a new version goes live:** it's trained on older jobs and tested on the most recent ones. It goes live only if it beats the basic rule, **and** beats the current live model on jobs that model hadn't seen. Otherwise it's saved as `REJECTED`. Every version is kept, so rolling back is one status change.

**Before 30 jobs:** the basic rule is used, and each estimate is labelled "Rough estimate". A staged approach (learning one overall correction from about 5 jobs) was discussed but isn't built.

**Measuring accuracy:** when a mover accepts or quotes, the estimate they saw is saved on the offer. `yarn ai:train` prints how far those estimates were from the real working time.

**Off switch:** `PROFIT_MODEL=off` in `.env` makes the estimate ignore the model and use the basic rule only.

**Where the code is:**

| Part                      | File                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Fitting, prediction, gate | [server/modules/mover/mover.duration-model.ts](server/modules/mover/mover.duration-model.ts)                   |
| Training and retraining   | [server/modules/mover/mover.duration-training.ts](server/modules/mover/mover.duration-training.ts)             |
| Database access           | [server/modules/mover/mover.duration-repository.ts](server/modules/mover/mover.duration-repository.ts)         |
| Stored versions and lock  | [server/shared/database/models/duration-model.model.ts](server/shared/database/models/duration-model.model.ts) |
| Command                   | [server/train-duration-model.ts](server/train-duration-model.ts)                                               |

**In production:** the model is a few KB in MongoDB, loaded into memory and re-read every 5 minutes, so a new version is picked up without a restart. No GPU or paid service is needed. On serverless hosting, training should move to a cron route so a request never waits on it.

---

## 5. Real data only

- **The fake mover seed was removed** (`server/seed-mover.ts` and its `db:seed:mover` script). It created fake clients, moves, offers, payouts and extra accounts. The only demo accounts left are the ones in `server/seed.ts`.
- **The mover screens use no hard-coded data.** Every screen loads from the API and shows an empty state when there's nothing yet.
- **Landing page stats:** on this branch the metrics strip read live figures from the database (completed moves, approved movers, the review-weighted rating and the six real zones), hiding any figure with no data behind it. When the branch was merged into `dev`, the landing had been rebuilt without a metrics strip, so `metrics.tsx` was not kept. The query is still available as `getPublicMetrics()` in [mover.public.ts](server/modules/mover/mover.public.ts) if a live strip comes back. See [INTEGRATION.md](INTEGRATION.md).
- **Sign-in panel** ([auth-panel.tsx](components/features/auth/auth-panel.tsx)): the invented "MOVER QUEUE: 237" is gone, and the zone count reads 6.

The landing footer still says "Serving Tunisia's main corridors since 2024". That's a business claim, so check it before launch.

---

## 6. Offline mode and phones

`yarn offline` runs the whole app on one computer with no internet: local MongoDB, local fonts and images, and a production build in `.next-offline`. Full details are in [OFFLINE.md](OFFLINE.md).

Changes made on this branch:

- The browser now calls the API on whatever address it opened, so **phones on the same Wi-Fi** can use the address the command prints (for example `http://192.168.1.20:3000`).
- The command prints those Wi-Fi addresses, rebuilds when `.env` changes, warns if MongoDB stops, and stops cleanly with Ctrl+C.
- Over plain `http` from a phone, the live camera is blocked by the phone, so box scanning uses **Photo of a label** or typing the code.

---

## 7. Database changes

**New collections:**

| Collection          | Purpose                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `boxscans`          | One document per box scanned into a van. Unique on `{ moveId, code }`.                                     |
| `durationmodels`    | Every trained version of the duration model, with its accuracy and status (`LIVE`, `RETIRED`, `REJECTED`). |
| `durationtrainings` | One lock document, so only one server trains at a time.                                                    |

**New fields:**

| Collection      | Field      | Purpose                                                        |
| --------------- | ---------- | -------------------------------------------------------------- |
| `moverprofiles` | `costs`    | The mover's own costs, or `null` to use the defaults.          |
| `joboffers`     | `estimate` | The duration estimate the mover saw when accepting or quoting. |

**Changed behaviour:** the load check's box count is now the number of scans. `confirmLoad` no longer accepts a typed box count.

**New setting:** `PROFIT_MODEL` (`on` by default, `off` to use the basic rules only). It's documented in [.env.example](.env.example).

No migration is needed: the new fields default to `null` and the new collections are created on first use.

---

## 8. How other parts connect to the mover side

The mover side is ready for real users, but it **depends on parts that aren't built yet**. Until they exist, no real offer can reach a mover.

**1. Clients create moves (client side).** Create a `MoveRequest` with status `SUBMITTED`, the pickup and drop-off areas (with a zone code from the six zones), date, time slot, volume, rooms, items and an `estimatedPrice` (or `null` if movers should quote). Generate the reference with `newMoveReference()`, and see the collision note in section 9.

**2. Sending a move to movers (admin or automatic).** Call:

```ts
import { dispatchMove } from '@/server/modules/mover';

await dispatchMove(moveId, { actorId: adminUserId, count: 3 });
```

It opens the move for quotes and offers it to the best eligible movers: approved, insured, working in the pickup zone, free that day, and with no other job then. Each offer lasts `OFFER_TTL_MINUTES` (120 by default), and then passes to the next mover.

**3. Approving movers (admin).** New movers sign up as `PENDING`. They need `verificationStatus: 'APPROVED'` on their `MoverProfile` before they can use the workspace. The admin "Mover reviews" page isn't connected yet.

**4. Routes already built for the client app:**

| Route                                          | Who                  | Purpose                                                              |
| ---------------------------------------------- | -------------------- | -------------------------------------------------------------------- |
| `POST /api/moves/[id]/quotes/[quoteId]/accept` | Client               | Accept a mover's quote; assigns the job                              |
| `POST /api/moves/[id]/confirm-delivery`        | Client               | Confirm delivery; completes the move and creates the mover's earning |
| `GET/POST /api/moves/[id]/messages`            | Client, mover, admin | Chat about a live move                                               |

If the client doesn't confirm delivery or open a claim within 48 hours, the move completes on its own.

**5. Background tasks.** Expiring offers, handing jobs on, auto-completion and document warnings run inside `sweep()`, which is currently called when a mover opens the app. Production needs a cron route calling `sweep()` every few minutes (see section 9).

---

## 9. Known gaps and audit findings

A full project audit was run on this branch. The build, type check, lint (0 errors) and all tests pass. These are the open points, most important first.

**Fix before production:**

1. **The example JWT secret is accepted.** The value in `.env.example` passes the length check in [env.ts](server/config/env.ts). Refuse it when `NODE_ENV=production`.
2. **`server/seed.ts` is unsafe on a production database.** It resets the admin password (falling back to a known one) and creates an approved mover and a client with public passwords. Add a production guard.
3. **No limit on sign-in attempts.** Sign-in, sign-up and token refresh accept unlimited attempts.

**Medium:**

4. **Refresh-token rotation isn't atomic.** Two simultaneous refreshes with the same token both succeed ([auth.service.ts](server/modules/auth/auth.service.ts)).
5. **Session tokens are readable by page scripts.** The access token is saved in `localStorage`, the refresh token is also returned in the sign-in response body, and there are no security headers.
6. **Move references can collide.** Five random digits per year give about a 50% chance of a duplicate within roughly 370 moves. Retry on a duplicate, or use a counter.
7. **Background tasks only run when movers use the app.** Add a cron route for `sweep()`.
8. ~~**Uploads are stored on the server's disk**~~ Fixed on `dev`: on Vercel, mover files go to the S3 bucket when `S3_*` is set, otherwise to MongoDB (`moverfiles`); local development keeps the disk. `MOVER_STORAGE` forces a backend.

**Not built yet:** client move creation, admin dispatch and mover approval, and the admin moves, assignments, disputes and review pages.

**Housekeeping:** tests only cover the mover module and there's no CI; there's no README; `yarn lint` uses the deprecated `next lint`; the project uses yarn only (`package-lock.json` was removed when this branch was merged into `dev`).

---

## 10. Tests and checks

The mover tests run against a real MongoDB and refuse to wipe any database whose name doesn't end in `_test`:

```bash
TEST_MONGODB_URI=mongodb://localhost:27017 yarn test:mover
```

150 tests cover access rules, offers, jobs, box scanning, profiles, rules, and the profitability estimate and duration model. The duration model tests check that:

- the model recovers the weights it was given from generated data,
- a model that's worse than the rules (or the live model) is never promoted,
- only one server trains at a time,
- training waits until there are enough finished jobs.

Other checks used on this branch:

```bash
npx tsc --noEmit
npx eslint .
npx next build
```

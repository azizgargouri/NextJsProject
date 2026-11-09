# Demo data — quality domain (Member 6)

Snapshot of the local `moveup` database used for the claims / reviews / AI demo.
Files are MongoDB Extended JSON (canonical), so `ObjectId`s and dates keep their types
and every cross-reference (`clientId`, `moverId`, `userId`) still points at the right user.

| File                      | Docs | Content                                                                                                         |
| :------------------------ | :--- | :-------------------------------------------------------------------------------------------------------------- |
| `demo/users.json`         | 4    | `admin@moveup.tn`, `client@moveup.tn`, `mover@moveup.tn`, `mover2@moveup.tn` (bcrypt hashes)                    |
| `demo/moverprofiles.json` | 2    | Mehdi Transport, Sahel Déménagement                                                                             |
| `demo/claims.json`        | 3    | `CLM-DEMO-0001` (glass table, with photo + Vision AI + AI mediation), `-0002` (delay), `-0003` (loss, resolved) |
| `demo/reviews.json`       | 4    | 3 published + 1 flagged as toxic by moderation                                                                  |

## Demo logins

| Role   | Email              | Password      |
| :----- | :----------------- | :------------ |
| Admin  | `admin@moveup.tn`  | `Admin#2026!` |
| Client | `client@moveup.tn` | `Demo#2026!`  |
| Mover  | `mover@moveup.tn`  | `Demo#2026!`  |
| Mover  | `mover2@moveup.tn` | `Demo#2026!`  |

## Load it into the hosted database

Option A — import this snapshot (needs MongoDB Database Tools: `brew install mongodb-database-tools`):

```bash
MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>/moveup" ./seed-data/import-demo.sh
```

Option B — regenerate it with the seed scripts (no extra tools; upserts by email):

```bash
MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>/moveup" yarn db:seed
MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>/moveup" yarn db:seed:quality
```

> If the hosted database already has these emails under **different** `_id`s (for example
> a teammate ran `yarn db:seed` there first), Option A fails on the unique `email` index.
> Use Option B in that case — it matches users by email instead of `_id`.

Not included on purpose: refresh tokens (sessions), audit logs, AI chat history, and local test claims.

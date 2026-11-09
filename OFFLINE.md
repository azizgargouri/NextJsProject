# Running MoveUp offline

The whole app (public site, client, mover and admin) runs on this computer with no internet.

```bash
npm run offline
```

Then open http://localhost:3000. Press Ctrl+C to stop.

If port 3000 is taken, choose another one:

```bash
PORT=3100 npm run offline
```

## What the command does

1. Creates `.env` from `.env.example` if it is missing, with a new JWT secret.
2. Uses the local MongoDB if it is running. Otherwise it starts `mongod` with its data in `.offline/db`.
3. Adds the demo data only if the database has no users, so your data is kept between runs.
4. Builds into `.next-offline` when the source has changed. This folder is separate from the `.next` folder that `npm run dev` uses.
5. Serves the production build.

## Demo accounts

These exist after the seed has run on an empty database.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `SEED_ADMIN_EMAIL` in `.env` | `SEED_ADMIN_PASSWORD` in `.env` |
| Client | `client@moveup.tn`, `client.test@moveup.tn` | `Demo#2026!` |
| Mover (approved) | `mover@moveup.tn`, `mover.test@moveup.tn` | `Demo#2026!` |
| Mover (pending) | `mover.pending@moveup.tn` | `Demo#2026!` |
| Mover (rejected) | `mover.rejected@moveup.tn` | `Demo#2026!` |

## Setting up another computer

These need to be in place before it goes offline:

- Node.js and MongoDB (`mongod` on the `PATH`, or set `MONGOD_PATH`).
- `node_modules`, from `npm install`.

## Limits

- Open it as `localhost`, not `127.0.0.1` or a network address: the API address is built in as `http://localhost:<port>`.
- The session cookie is not `Secure` in this mode, so use it only on your own computer.
- The bundled fonts cover Latin characters, including French accents. Other scripts use a system font.

# Running MoveUp offline

The whole app (public site, client, mover and admin) runs on this computer with no internet.

```bash
yarn offline
```

Then open http://localhost:3000. Press Ctrl+C to stop.

If port 3000 is taken, choose another one:

```bash
PORT=3100 yarn offline
```

## What the command does

1. Creates `.env` from `.env.example` if it is missing, with a new JWT secret.
2. Uses the local MongoDB if it is running. Otherwise it starts `mongod` with its data in `.offline/db`.
3. Adds the demo data only if the database has no users, so your data is kept between runs.
4. Builds into `.next-offline` when the source or `.env` has changed. This folder is separate from the `.next` folder that `yarn dev` uses.
5. Serves the production build, and prints the address for phones on the same Wi-Fi.

## Using it from a phone

Movers work from their phones. With the phone on the same Wi-Fi as this computer, open the address the command prints, such as `http://192.168.1.20:3000`. No internet is needed, only the local network.

Phones block the live camera on plain `http` addresses. So when scanning box labels, the mover uses **Photo of a label** instead of live scanning, or types the code. On this computer itself (`localhost`), live scanning works.

## Demo accounts

These exist after the seed has run on an empty database.

| Role             | Email                        | Password                        |
| ---------------- | ---------------------------- | ------------------------------- |
| Admin            | `SEED_ADMIN_EMAIL` in `.env` | `SEED_ADMIN_PASSWORD` in `.env` |
| Client           | `client@moveup.tn`           | `Demo#2026!`                    |
| Mover (approved) | `mover@moveup.tn`            | `Demo#2026!`                    |

The mover workspace starts empty, with no offers, jobs or earnings. Offers appear once a client submits a move and the back office dispatches it to movers.

## Setting up another computer

These need to be in place before it goes offline:

- Node.js and MongoDB (`mongod` on the `PATH`, or set `MONGOD_PATH`).
- `node_modules`, from `yarn install`.

## Limits

- The session cookie is not `Secure` in this mode, so use it only on a network you trust.
- The bundled fonts cover Latin characters, including French accents. Other scripts use a system font.

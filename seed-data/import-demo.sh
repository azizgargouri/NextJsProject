#!/usr/bin/env bash
# Loads the MoveUp quality-domain demo data (users, mover profiles, claims, reviews)
# into any MongoDB, e.g. the team's hosted Atlas cluster.
#
#   MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/moveup" ./seed-data/import-demo.sh
#
# Upserts by _id, so running it twice does not create duplicates.
set -euo pipefail

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "Set MONGODB_URI first (it must include the database name, e.g. .../moveup)." >&2
  exit 1
fi

DIR="$(cd "$(dirname "$0")/demo" && pwd)"

# Order matters only for readability; there are no foreign-key constraints in MongoDB.
for collection in users moverprofiles claims reviews; do
  echo "→ importing ${collection}"
  mongoimport --uri "$MONGODB_URI" \
    --collection "$collection" \
    --file "$DIR/${collection}.json" \
    --jsonArray \
    --mode=upsert
done

echo "Done. Demo logins: admin@moveup.tn / Admin#2026!  ·  client@ | mover@ | mover2@moveup.tn / Demo#2026!"


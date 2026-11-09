# MoveUp — Claude Agent Guide: Seeding & Integrating Member 6 (Quality, Claims, Reviews & AI)

> **Instructions for Claude Agent**:
> You are assisting the MoveUp engineering team in seeding the hosted MongoDB database (`moveup`) and integrating **Member 6's Quality & AI module** (Claims, Disputes, Reviews, Moderation, Multimodal Vision AI, and Vercel AI SDK).
> Execute the steps below autonomously using your terminal/bash tools. Do **not** drop existing collections or overwrite other team members' data — all operations below are idempotent upserts.

---

## 1. Environment Variables Required (`.env` / `.env.local` / Vercel)

Verify that the target environment (`.env.local` or hosted deployment) defines:

```ini
# Hosted MongoDB Atlas URI (must include database name, e.g., /moveup)
MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/moveup?retryWrites=true&w=majority"

# Auth JWT secret (minimum 16 chars)
JWT_SECRET="dev-secret-change-me-in-production-min-16-chars"

# Vercel AI SDK Provider ('google' or 'openai')
AI_PROVIDER="google"
GOOGLE_GENERATIVE_AI_API_KEY="<your-gemini-api-key>"
# Optional: OPENAI_API_KEY="sk-..." (if AI_PROVIDER="openai")
# Optional: AI_COOLDOWN_MS="300000" (5-minute circuit breaker cooldown when free-tier quota is reached)
```

> **Note on AI Fallback & Circuit Breaker**:
> Every AI feature in Member 6 has a deterministic rule-engine twin (`server/modules/ai/ai.fallback.ts`) and an automatic quota circuit breaker (`server/modules/ai/ai.provider.ts`). If no API key is configured or free-tier quota (`429 RESOURCE_EXHAUSTED`) is reached, the app automatically serves schema-valid results without failing.

---

## 2. How to Seed the Hosted MongoDB Database

Choose **Path A** (recommended if you are on `feat/member6-quality-ai-v2` or `main` after merge) or **Path B** (if you want to import the exact pre-generated Extended JSON snapshot) or **Path C** (standalone `mongosh` script if you are on another branch and only have this `.md` file).

### Path A — Idempotent TypeScript Seed Scripts (Recommended)

This matches existing users by `email` (so it never conflicts with `_id`s created by other teammates) and upserts the 4 demo accounts, 2 mover profiles, 3 canonical claims (`CLM-DEMO-0001..0003`), and 4 reviews (`3 PUBLISHED`, `1 FLAGGED`):

```bash
MONGODB_URI="<YOUR_HOSTED_MONGODB_URI>" yarn db:seed
MONGODB_URI="<YOUR_HOSTED_MONGODB_URI>" yarn db:seed:quality
```

### Path B — Import Pre-Exported Extended JSON Snapshot (`seed-data/`)

If `mongoimport` is installed and you want the exact binary snapshot (including annotated multi-photo claim `CLM-261109-23ZR`):

```bash
chmod +x ./seed-data/import-demo.sh
MONGODB_URI="<YOUR_HOSTED_MONGODB_URI>" ./seed-data/import-demo.sh
```

Files used by `./seed-data/import-demo.sh`:

- `seed-data/demo/users.json` (4 users)
- `seed-data/demo/moverprofiles.json` (2 mover profiles)
- `seed-data/demo/claims.json` (4 claims with Vision AI + ROI annotations + AI Mediation)
- `seed-data/demo/reviews.json` (4 reviews with AI Moderation + aspect scores)

---

### Path C — Standalone Self-Contained Node/Mongoose Seed Script (Works on ANY Branch)

If your current branch does not yet have `server/quality.seed.ts` or `seed-data/`, run this self-contained command to upsert the entire demo dataset directly into `MONGODB_URI`:

```bash
node --input-type=module -e '
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("Missing MONGODB_URI"); process.exit(1); }

await mongoose.connect(uri);
const db = mongoose.connection.db;
const now = new Date();
const daysAgo = (d) => new Date(Date.now() - d * 86400000);

// 1. Upsert Demo Users by email
const usersToSeed = [
  { email: "admin@moveup.tn", pass: "Admin#2026!", name: "MoveUp Admin", phone: "+21671000000", role: "ADMIN", locale: "fr" },
  { email: "client@moveup.tn", pass: "Demo#2026!", name: "Amira Ben Salah", phone: "+21622111222", role: "CLIENT", locale: "fr" },
  { email: "mover@moveup.tn", pass: "Demo#2026!", name: "Mehdi Transport", phone: "+21655333444", role: "MOVER", locale: "fr" },
  { email: "mover2@moveup.tn", pass: "Demo#2026!", name: "Sahel Déménagement", phone: "+21697222333", role: "MOVER", locale: "fr" },
];

const userMap = {};
for (const u of usersToSeed) {
  const passwordHash = await bcrypt.hash(u.pass, 10);
  const res = await db.collection("users").findOneAndUpdate(
    { email: u.email },
    {
      $set: { name: u.name, phone: u.phone, role: u.role, locale: u.locale, status: "ACTIVE", passwordHash, deletedAt: null, updatedAt: now },
      $setOnInsert: { email: u.email, createdAt: now }
    },
    { upsert: true, returnDocument: "after" }
  );
  userMap[u.email] = String(res._id);
}

// 2. Upsert Mover Profiles
const profiles = [
  { userId: userMap["mover@moveup.tn"], companyName: "Mehdi Transport SARL", zones: ["TUN", "ARI", "BEN"], verificationStatus: "APPROVED", ratingAvg: 3.5, ratingCount: 2 },
  { userId: userMap["mover2@moveup.tn"], companyName: "Sahel Déménagement", zones: ["SOU", "MON"], verificationStatus: "APPROVED", ratingAvg: 3.0, ratingCount: 1 },
];
for (const p of profiles) {
  await db.collection("moverprofiles").updateOne(
    { userId: p.userId },
    { $set: { ...p, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
}

// 3. Upsert Demo Claims
const clientId = userMap["client@moveup.tn"];
const moverId = userMap["mover@moveup.tn"];
const mover2Id = userMap["mover2@moveup.tn"];
const adminId = userMap["admin@moveup.tn"];

const claims = [
  {
    reference: "CLM-DEMO-0001",
    clientId,
    moverId,
    moveReference: "MV-2026-0142",
    category: "DAMAGE",
    priority: "HIGH",
    status: "UNDER_REVIEW",
    subject: "Glass table broken during unloading",
    description: "The glass coffee table arrived with a large crack. The crew said it was already damaged but it was fine at pickup. I have photos from before the move.",
    amountClaimed: 450,
    evidencePhotos: [],
    visionAnalysis: {
      source: "rules",
      model: null,
      detectedItems: [
        {
          name: "Tempered Glass Coffee Table",
          material: "Tempered glass & powder-coated steel frame",
          damageType: "Deep diagonal impact fracture across top surface",
          severity: "SEVERE",
          damageRatePct: 88,
          repairable: false,
          estimatedCostTnd: 420
        }
      ],
      overallSeverity: "SEVERE",
      overallDamageRatePct: 88,
      suggestedCategory: "DAMAGE",
      estimatedRepairMinTnd: 350,
      estimatedRepairMaxTnd: 520,
      recommendedClaimAmountTnd: 420,
      suggestedSubject: "Cracked tempered glass coffee table during unloading",
      suggestedDescription: "Visual inspection shows a severe diagonal stress fracture across the tempered glass tabletop consistent with an impact during transit or unloading. Full glass panel replacement is required.",
      authenticityNotes: "Consistent indoor lighting and fresh fracture edges; no prior oxidation on steel frame.",
      confidence: 0.94,
      analyzedAt: daysAgo(3)
    },
    aiTriage: {
      source: "rules",
      model: null,
      category: "DAMAGE",
      priority: "HIGH",
      summary: "Glass table broken during unloading (450 TND claimed)",
      suggestedAction: "Request before/after photos and the signed inventory sheet from both parties.",
      sentiment: "NEGATIVE",
      confidence: 0.9,
      createdAt: daysAgo(3)
    },
    aiMediation: {
      source: "rules",
      model: null,
      recommendedOutcome: "PARTIAL_REFUND",
      recommendedAmountTnd: 420,
      clientLiabilityPct: 15,
      moverLiabilityPct: 85,
      confidenceScore: 0.89,
      riskLevel: "HIGH",
      executiveSummary: "Claim CLM-DEMO-0001 (DAMAGE): Recommended PARTIAL_REFUND of 420 TND (85% mover liability / 15% client co-responsibility).",
      policyCitations: [
        "Art. 14 MoveUp Charter — Carrier transit liability for physical damage during loading/unloading",
        "Art. 19 MoveUp Charter — Vision AI verified repair/replacement market valuation in TND"
      ],
      evidenceFactors: [
        "Client claimed amount: 450 TND",
        "Vision AI photo inspection: SEVERE severity, estimated 420 TND",
        "Mover track record: 3.5/5 rating across 2 total claim(s)"
      ],
      compensationBreakdown: [
        { item: "Verified item repair / replacement base", amountTnd: 420, rationale: "Anchored on Multimodal Vision AI market estimate in TND" },
        { item: "Recommended net settlement", amountTnd: 420, rationale: "85% mover liability applied under MoveUp Dispute Charter" }
      ],
      draftResolutionNote: "Following review of claim CLM-DEMO-0001 and the submitted visual evidence, MoveUp Dispute Resolution approves a partial refund of 420 TND.",
      generatedAt: daysAgo(2)
    },
    resolution: null,
    timeline: [
      { kind: "CREATED", authorId: clientId, authorRole: "CLIENT", text: "Claim submitted", status: "OPEN", createdAt: daysAgo(3) },
      { kind: "STATUS_CHANGED", authorId: adminId, authorRole: "ADMIN", text: "We are reviewing your claim with the mover.", status: "UNDER_REVIEW", createdAt: daysAgo(2) },
      { kind: "MESSAGE", authorId: moverId, authorRole: "MOVER", text: "We checked with the crew; we will cooperate fully.", status: null, createdAt: daysAgo(2) }
    ],
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2)
  },
  {
    reference: "CLM-DEMO-0002",
    clientId,
    moverId,
    moveReference: "MV-2026-0118",
    category: "DELAY",
    priority: "LOW",
    status: "OPEN",
    subject: "Crew arrived three hours late",
    description: "L équipe est arrivée avec 3 heures de retard sans prévenir. J ai dû prendre un jour de congé supplémentaire.",
    amountClaimed: null,
    evidencePhotos: [],
    visionAnalysis: null,
    aiTriage: {
      source: "rules",
      model: null,
      category: "DELAY",
      priority: "LOW",
      summary: "Crew arrived three hours late",
      suggestedAction: "Check crew GPS timestamps against the booked slot and apply the delay policy.",
      sentiment: "NEGATIVE",
      confidence: 0.85,
      createdAt: daysAgo(1)
    },
    aiMediation: null,
    resolution: null,
    timeline: [
      { kind: "CREATED", authorId: clientId, authorRole: "CLIENT", text: "Claim submitted", status: "OPEN", createdAt: daysAgo(1) }
    ],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1)
  },
  {
    reference: "CLM-DEMO-0003",
    clientId,
    moverId: mover2Id,
    moveReference: "MV-2026-0097",
    category: "LOSS",
    priority: "HIGH",
    status: "RESOLVED",
    subject: "One box of kitchenware missing",
    description: "A box labelled KITCHEN 3 never arrived at the new apartment in Sousse. It contained plates and a coffee machine.",
    amountClaimed: 380,
    evidencePhotos: [],
    visionAnalysis: null,
    aiTriage: {
      source: "rules",
      model: null,
      category: "LOSS",
      priority: "HIGH",
      summary: "One box of kitchenware missing (380 TND claimed)",
      suggestedAction: "Cross-check the box count on the loading sheet and ask the mover to search the truck.",
      sentiment: "NEGATIVE",
      confidence: 0.9,
      createdAt: daysAgo(12)
    },
    aiMediation: null,
    resolution: {
      outcome: "PARTIAL_REFUND",
      amount: 250,
      note: "The box was lost in transit. The mover refunds 250 TND (declared value of the coffee machine and plates).",
      resolvedBy: adminId,
      resolvedAt: daysAgo(8)
    },
    timeline: [
      { kind: "CREATED", authorId: clientId, authorRole: "CLIENT", text: "Claim submitted", status: "OPEN", createdAt: daysAgo(12) },
      { kind: "STATUS_CHANGED", authorId: adminId, authorRole: "ADMIN", text: "We are reviewing your claim with the mover.", status: "UNDER_REVIEW", createdAt: daysAgo(11) },
      { kind: "RESOLUTION", authorId: adminId, authorRole: "ADMIN", text: "The box was lost in transit. The mover refunds 250 TND (declared value of the coffee machine and plates).", status: "RESOLVED", createdAt: daysAgo(8) }
    ],
    createdAt: daysAgo(12),
    updatedAt: daysAgo(8)
  }
];

for (const c of claims) {
  await db.collection("claims").updateOne({ reference: c.reference }, { $set: c }, { upsert: true });
}

// 4. Upsert Demo Reviews
const reviews = [
  {
    clientId, moverId, moveReference: "MV-2026-0101",
    rating: 5, punctuality: 5, care: 5, communication: 4,
    comment: "Very professional team, on time and careful with fragile items. Highly recommend!",
    status: "PUBLISHED",
    moderation: { source: "rules", model: null, sentiment: "POSITIVE", toxic: false, reasons: [], topics: ["PUNCTUALITY", "CARE", "PROFESSIONALISM"], createdAt: now },
    moderationNote: null, moderatedBy: null, moverReply: null, createdAt: daysAgo(10), updatedAt: daysAgo(10)
  },
  {
    clientId, moverId, moveReference: "MV-2026-0118",
    rating: 2, punctuality: 1, care: 3, communication: 2,
    comment: "Three hours late and no call to warn us. The move itself was ok.",
    status: "PUBLISHED",
    moderation: { source: "rules", model: null, sentiment: "NEGATIVE", toxic: false, reasons: [], topics: ["PUNCTUALITY", "COMMUNICATION"], createdAt: now },
    moderationNote: null, moderatedBy: null, moverReply: null, createdAt: daysAgo(2), updatedAt: daysAgo(2)
  },
  {
    clientId, moverId: mover2Id, moveReference: "MV-2026-0097",
    rating: 3, punctuality: 4, care: 2, communication: 4,
    comment: "Équipe sympathique mais un carton a disparu. Le support a bien géré la réclamation.",
    status: "PUBLISHED",
    moderation: { source: "rules", model: null, sentiment: "NEUTRAL", toxic: false, reasons: [], topics: ["CARE"], createdAt: now },
    moderationNote: null, moderatedBy: null, moverReply: null, createdAt: daysAgo(7), updatedAt: daysAgo(7)
  },
  {
    clientId, moverId: mover2Id, moveReference: "MV-2026-0150",
    rating: 1, punctuality: null, care: null, communication: null,
    comment: "Bande de voleurs, appelez-moi au +216 55 123 456 si vous osez",
    status: "FLAGGED",
    moderation: { source: "rules", model: null, sentiment: "NEGATIVE", toxic: true, reasons: ["Insult or defamatory language", "Personal contact detail in a public review"], topics: [], createdAt: now },
    moderationNote: null, moderatedBy: null, moverReply: null, createdAt: daysAgo(1), updatedAt: daysAgo(1)
  }
];

for (const r of reviews) {
  await db.collection("reviews").updateOne(
    { clientId: r.clientId, moverId: r.moverId, moveReference: r.moveReference },
    { $set: r },
    { upsert: true }
  );
}

console.log("Seeded MoveUp quality demo data successfully!");
await mongoose.disconnect();
'
```

---

## 3. Demo Credentials & Role Matrix

Once seeded, anyone on the team can test the 3 roles at `/sign-in`:

| Role        | Email              | Password      | Main Routes                                                                                |
| :---------- | :----------------- | :------------ | :----------------------------------------------------------------------------------------- |
| **Admin**   | `admin@moveup.tn`  | `Admin#2026!` | `/admin/disputes`, `/admin/mover-reviews`, `/admin/users`, `/admin/audit`                  |
| **Client**  | `client@moveup.tn` | `Demo#2026!`  | `/dashboard/claims`, `/dashboard/claims/new`, `/dashboard/reviews`, `/dashboard/assistant` |
| **Mover 1** | `mover@moveup.tn`  | `Demo#2026!`  | `/dashboard/claims` (Targeted claims), `/dashboard/reviews` (AI reply coach)               |
| **Mover 2** | `mover2@moveup.tn` | `Demo#2026!`  | `/dashboard/claims`, `/dashboard/reviews`                                                  |

---

## 4. Cross-Module Integration Contract (For Other Team Members' Modules)

When linking the **Moves / Bookings / Quotes** modules (Members 2–5) with **Member 6 (Claims & Reviews)**:

1. **`moveReference` (`string`)**:
   - Claims (`claims` collection) and Reviews (`reviews` collection) reference a completed move via `moveReference` (e.g., `"MV-2026-0142"`).
   - In `app/(dashboard)/dashboard/claims/new/page.tsx` and `app/(dashboard)/dashboard/reviews/page.tsx`, the `completedMoves` list is passed to `<ClaimForm />` and `<ReviewForm />`.
   - When the team's `MoveModel` / `BookingModel` is merged, replace or augment the `completedMoves` array in those two server pages with a query for `status: 'COMPLETED'` moves belonging to `user.id`.
2. **`clientId` and `moverId` (`string`)**:
   - Stored as 24-character hex string representations of `UserModel._id` (`String(user._id)`).
3. **`MoverProfileModel` (`moverprofiles` collection)**:
   - Every time a review is published or moderated via `reviewsService`, `reviewsRepository.syncMoverRating(moverId)` automatically recalculates and updates `ratingAvg` and `ratingCount` on `MoverProfileModel`.

---

## 5. Post-Seed Verification Command for Claude Agent

Run this check after seeding to verify all 4 collections are populated and linked:

```bash
mongosh "$MONGODB_URI" --quiet --eval '
  print("users:", db.users.countDocuments({ email: { $in: ["admin@moveup.tn", "client@moveup.tn", "mover@moveup.tn", "mover2@moveup.tn"] } }));
  print("moverprofiles:", db.moverprofiles.countDocuments());
  print("claims:", db.claims.countDocuments());
  print("reviews:", db.reviews.countDocuments());
'
```

Expected output: `users: 4`, `moverprofiles: >= 2`, `claims: >= 3`, `reviews: >= 4`.

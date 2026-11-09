# MoveUp — Claude Agent Master Integration Guide: Member 6 (Quality, Claims, Reviews & AI)

> [!IMPORTANT]
> **Instructions for Claude Agent**:
> You are integrating **Member 6 (Quality, Claims, Reviews, Moderation & Vercel AI SDK)** into the MoveUp codebase.
> This single guide covers the **complete integration across all 3 user roles**:
>
> 1. **Client Workspace**: File claims with multi-photo upload & red-rectangle ROI damage detection, write reviews with auto-scoring, and chat with the AI Assistant.
> 2. **Mover Workspace**: View claims/dossiers filed against the company, reply in dispute threads with AI suggestions, reply publicly to customer reviews, and view the public AI Trust Scorecard.
> 3. **Admin Back-Office**: Disputes inbox, 600-line Claim Arbitration Sheet with Multimodal Vision AI scan, AI Dispute Mediator (`streamObject` + `useObject`), and resolution letter drafting (`useCompletion`).
> 4. **Hosted Database**: Idempotent seeding of demo accounts, mover profiles, claims, and reviews.

---

## 1. Quick Git Pull / Merge

All Member 6 code, route handlers, components, and tests are on branch `feat/member6-quality-ai-v2`.
To bring these changes into your working branch:

```bash
git fetch origin feat/member6-quality-ai-v2
git merge origin/feat/member6-quality-ai-v2 --no-edit
```

_(Or cherry-pick the required files listed in Section 3)._

---

## 2. Seed the Hosted MongoDB Database

Run these idempotent seed commands to populate accounts, mover profiles, claims with Vision AI, and reviews:

```bash
# Option A: Using the TypeScript seed scripts (Recommended)
MONGODB_URI="<YOUR_HOSTED_MONGODB_URI>" yarn db:seed
MONGODB_URI="<YOUR_HOSTED_MONGODB_URI>" yarn db:seed:quality

# Option B: If mongoimport is available, import the canonical Extended JSON snapshot:
chmod +x ./seed-data/import-demo.sh
MONGODB_URI="<YOUR_HOSTED_MONGODB_URI>" ./seed-data/import-demo.sh
```

### Seeded Demo Accounts:

| Role        | Email              | Password      | Primary Purpose                                                                                 |
| :---------- | :----------------- | :------------ | :---------------------------------------------------------------------------------------------- |
| **Admin**   | `admin@moveup.tn`  | `Admin#2026!` | Access `/admin/disputes`, `/admin/mover-reviews`, `/admin/users`, `/admin/audit`                |
| **Client**  | `client@moveup.tn` | `Demo#2026!`  | Access `/dashboard/claims`, `/dashboard/reviews`, `/dashboard/assistant`                        |
| **Mover 1** | `mover@moveup.tn`  | `Demo#2026!`  | Mehdi Transport (`/dashboard/claims`, `/dashboard/reviews`, `/movers/6adf1d078470fbc93fdc72b5`) |
| **Mover 2** | `mover2@moveup.tn` | `Demo#2026!`  | Sahel Déménagement (`/dashboard/claims`, `/dashboard/reviews`)                                  |

---

## 3. Inventory of Member 6 Files & Routes

Ensure these core files exist in your repository:

### Backend Route Handlers (`app/api/`):

- `app/api/claims/route.ts` — `GET` & `POST` claims for clients/movers.
- `app/api/claims/[id]/route.ts` — `GET` single claim detail.
- `app/api/admin/claims/route.ts` — `GET` dispute inbox with filters.
- `app/api/admin/claims/[id]/route.ts` — `GET` & `PATCH` priority, status, and resolution decisions.
- `app/api/ai/claims/vision/route.ts` — Multimodal Vision AI damage assessment.
- `app/api/ai/claims/[id]/mediate/route.ts` — AI Dispute Mediator & Compensation Calculator (`streamObject`).
- `app/api/ai/claims/[id]/draft/route.ts` — AI Resolution Letter Draft (`streamText` + `useCompletion`).
- `app/api/ai/chat/route.ts` — Conversational assistant with 4 live MongoDB tools (`streamText` + `useChat`).
- `app/api/ai/reviews/insights/route.ts` — Executive review sentiment insights (`streamObject`).
- `app/api/ai/movers/[id]/scorecard/route.ts` — Public AI Trust Scorecard (`streamObject`).

### Server Services & Modules (`server/modules/`):

- `server/modules/claims/` — `claims.service.ts`, `claims.repository.ts`, `claims.schema.ts`, `claims.serializer.ts`.
- `server/modules/reviews/` — `reviews.service.ts`, `reviews.repository.ts`, `reviews.schema.ts`, `reviews.serializer.ts`.
- `server/modules/ai/` — `ai.analysis.ts`, `ai.provider.ts` (Circuit Breaker), `ai.fallback.ts` (Rule Engine), `ai.chat.ts` (MongoDB Tools), `ai.insights.ts`.

### Frontend Components (`components/features/`):

- `components/features/admin/disputes/disputes-portal.tsx` — Admin dispute inbox table & filters.
- `components/features/admin/disputes/claim-sheet.tsx` — Full 600-line Claim Arbitration Sheet.
- `components/features/workspace/claim-form.tsx` — Completed Move Selector + Multi-Photo ROI drawing canvas.
- `components/features/workspace/evidence-photo-gallery.tsx` — Photo grid + full-screen Lightbox modal with ROI damage rates.
- `components/features/workspace/review-form.tsx` — Review submission + AI Polish & Evidence-Grounded Auto-Scoring.
- `components/features/workspace/mover-scorecard.tsx` — Public AI Trust & Reliability Scorecard.
- `components/features/workspace/print-dossier-button.tsx` — Printable claim dossier export (PDF).

---

## 4. Integration Step 1: Mover Workspace Navigation

In your Mover navigation bar / sidebar component (e.g., `components/features/mover/layout.tsx` or similar), add links to Claims, Reviews, Assistant, and the Public Scorecard:

```tsx
import Link from 'next/link';
import { AlertCircle, Bot, Star, UserCheck } from 'lucide-react';

export function MoverNavSection({ moverId }: { moverId: string }) {
  return (
    <div className="space-y-1">
      <Link
        href="/dashboard/claims"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        <AlertCircle className="size-4 text-hazard" />
        <span>Claims & Disputes</span>
      </Link>

      <Link
        href="/dashboard/reviews"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        <Star className="size-4 text-amber-500" />
        <span>Reviews & Replies</span>
      </Link>

      <Link
        href="/dashboard/assistant"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        <Bot className="size-4 text-primary" />
        <span>MoveUp AI Assistant</span>
      </Link>

      <Link
        href={`/movers/${moverId}`}
        target="_blank"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-hazard hover:bg-muted"
      >
        <UserCheck className="size-4" />
        <span>Public Trust Scorecard ↗</span>
      </Link>
    </div>
  );
}
```

> **Note on Mover Permissions**:  
> The backend (`claimsService.listForParty` and `reviewsService.listForParty`) automatically isolates data for movers: movers ONLY see claims and reviews targeting their `moverId`. In claims threads, movers have access to the **`✨ Suggest AI reply`** action to draft professional responses.

---

## 5. Integration Step 2: Admin Disputes Desk & Claim Sheet

To ensure the Admin Disputes Desk displays full details and priority updates never fail:

1. **Mount `<ClaimSheet />` in `disputes-portal.tsx`**:

   ```tsx
   import { ClaimSheet } from './claim-sheet';

   export function DisputesPortal() {
     const [selected, setSelected] = useState<string | null>(null);

     return (
       <div>
         {/* Table and stats... */}
         {/* Row click: onClick={() => setSelected(claim.id)} */}

         <ClaimSheet claimId={selected} onOpenChange={(open) => !open && setSelected(null)} />
       </div>
     );
   }
   ```

2. **Verify Resilient Auth Guard in `server/shared/auth/guards.ts`**:
   Ensure `requireAuth` in `server/shared/auth/guards.ts` supports falling back to the httpOnly `moveup_refresh` cookie when Axios does not send a Bearer header:
   ```ts
   export async function requireAuth(request: Request): Promise<AccessTokenPayload> {
     const tokenUser = await getCurrentUser(request);
     if (tokenUser) {
       const storedUser = await new UserRepository().findOneById(tokenUser.sub);
       if (!storedUser || storedUser.deletedAt) throw new UnauthorizedError();
       if (storedUser.status === 'BLOCKED') throw new ForbiddenError('Account is blocked');
       return { ...tokenUser, email: storedUser.email, role: storedUser.role };
     }

     try {
       const { userFromRefreshCookie } = await import('./session');
       const session = await userFromRefreshCookie();
       if (session) {
         const nowSec = Math.floor(Date.now() / 1000);
         return {
           sub: session.sub,
           email: session.email,
           role: session.role,
           iat: nowSec,
           exp: nowSec + 3600,
         };
       }
     } catch {}

     throw new UnauthorizedError();
   }
   ```

---

## 6. Integration Step 3: Public Mover Profile & AI Scorecard (`/movers/[id]`)

In `app/movers/[id]/page.tsx`, embed the `<MoverScorecardCard />` right beneath the rating summary:

```tsx
import { RatingSummary } from '@/components/features/workspace/rating-summary';
import { MoverScorecardCard } from '@/components/features/workspace/mover-scorecard';

export default async function MoverPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await load((await params).id);
  if (!profile) notFound();

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-14">
      {/* Mover header */}
      <RatingSummary summary={profile.summary} />

      {/* Vercel AI SDK Structured Output Stream */}
      <MoverScorecardCard moverId={profile.mover.id} moverName={profile.mover.name} />

      {/* Published reviews list */}
    </main>
  );
}
```

---

## 7. Zero-Downtime AI Circuit Breaker Guarantee

If your deployment does not have an active `GOOGLE_GENERATIVE_AI_API_KEY` or `OPENAI_API_KEY`, or hits a free-tier rate limit (`429 RESOURCE_EXHAUSTED`):

- The app **does not crash or hang**.
- `server/modules/ai/ai.provider.ts` trips an automatic cooldown and immediately serves the deterministic rule engines in `server/modules/ai/ai.fallback.ts` and `ai.insights.ts`.
- Every streaming endpoint (`useChat`, `useObject`, `useCompletion`) delivers progressive token/chunk streaming even in offline or fallback mode!

---

## 8. Verification Checklist for Claude Agent

Run these commands in terminal to verify everything compiles and passes 100%:

```bash
# 1. Typecheck the entire project
npx tsc --noEmit

# 2. Run all 18 Member 6 unit tests
yarn test

# 3. Check dev server on http://localhost:3000
yarn dev
```

### Test User Verification:

1. **As Admin** (`admin@moveup.tn` / `Admin#2026!`):
   - Go to `/admin/disputes`.
   - Click `CLM-DEMO-0001` → Sheet opens with photos, Vision AI scan, and AI Mediator.
   - Change Priority to **URGENT** → verifies `PATCH /api/admin/claims/:id` works with 0 errors.
   - Click **Run AI Mediator** → verifies `POST /api/ai/claims/:id/mediate` streams live.
2. **As Mover** (`mover@moveup.tn` / `Demo#2026!`):
   - Go to `/dashboard/claims` → see claims targeting Mehdi Transport.
   - Go to `/dashboard/reviews` → see rating summary and reply.
   - Open `/movers/6adf1d078470fbc93fdc72b5` → click **Generate AI Trust Scorecard**.
3. **As Client** (`client@moveup.tn` / `Demo#2026!`):
   - Go to `/dashboard/claims/new` → Completed Move Selector + Multi-Photo ROI drawing canvas.
   - Go to `/dashboard/assistant` → chat with AI using live MongoDB tools.

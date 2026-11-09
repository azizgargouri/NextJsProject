# MoveUp — Claude Agent Guide: Adding Claims, Reviews & AI to the Mover Workspace

> [!IMPORTANT]
> **Instructions for Claude Agent**:
> You are updating the **Mover side** (Mover Dashboard, Mover Navigation, and Mover Profile) to connect with **Member 6's Quality & AI module**.
> Currently, the Mover workspace is missing links and views for **Claims / Disputes**, **Customer Reviews & Replies**, the **AI Assistant**, and the **Public AI Scorecard**.
> Follow the steps below to integrate them cleanly into the Mover navigation and profile layout.

---

## 1. What Needs to Be Added to the Mover Side

Member 6 already implemented the full backend, Server Actions, and UI components for Movers. Your task is to **expose these routes and components in the Mover navigation, layout, and profile**.

| Feature                           | Route / URL            | What It Does for the Mover                                                                                                                                                              |
| :-------------------------------- | :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Disputes & Claims**             | `/dashboard/claims`    | Mover sees all claims filed against their company, inspects photo evidence + Vision AI damage scans, and replies in the message thread with **`✨ Suggest AI reply`** (`generateText`). |
| **Reviews & Ratings**             | `/dashboard/reviews`   | Mover sees published customer reviews, overall/sub-ratings (Punctuality, Care, Communication), and writes public replies with **`✨ AI Suggest Reply`**.                                |
| **MoveUp AI Assistant**           | `/dashboard/assistant` | Mover chats with the AI agent using live MongoDB tools (`getMyClaims`, `getClaimDetails`, `estimateCompensation`) to track ongoing disputes.                                            |
| **Public Profile & AI Scorecard** | `/movers/[moverId]`    | Public storefront page showing the mover's rating summary and live **AI Trust & Reliability Scorecard** (`streamObject` + `useObject`).                                                 |

---

## 2. Step 1: Add Navigation Links to the Mover Sidebar / Navbar

In your Mover navigation bar or dashboard layout (e.g., `components/features/mover/layout.tsx` or `components/layouts/mover-sidebar.tsx`), add navigation links for **Claims**, **Reviews**, and **Assistant**:

```tsx
import Link from 'next/link';
import { AlertCircle, Bot, Star, UserCheck } from 'lucide-react';

export function MoverNavLinks({ moverId }: { moverId: string }) {
  return (
    <nav className="flex flex-col gap-1">
      {/* Existing mover links (e.g. Missions, Calendar, Fleet)... */}

      {/* --- MEMBER 6 QUALITY & AI LINKS --- */}
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

      {/* Link to Mover's Public Scorecard */}
      <Link
        href={`/movers/${moverId}`}
        target="_blank"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-hazard hover:bg-muted"
      >
        <UserCheck className="size-4" />
        <span>View My Public Scorecard ↗</span>
      </Link>
    </nav>
  );
}
```

---

## 3. Step 2: Embed the AI Mover Scorecard in the Mover Profile / Analytics View

If your mover profile or settings page has a company profile or reputation tab, embed the **`<MoverScorecardCard />`** component directly so the mover can preview their AI Trust Score and Watchouts:

```tsx
import { MoverScorecardCard } from '@/components/features/workspace/mover-scorecard';

export function MoverReputationTab({ moverId, moverName }: { moverId: string; moverName: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Company Reputation & Quality</h2>
        <p className="text-sm text-muted-foreground">
          Real-time AI analysis of your reviews and dispute resolution record.
        </p>
      </div>

      {/* Pre-built interactive Vercel AI SDK Scorecard component */}
      <MoverScorecardCard moverId={moverId} moverName={moverName} />
    </div>
  );
}
```

---

## 4. Step 3: Role & Auth Verification (No Changes Needed on Backend)

Member 6 already configured the backend guards and services to support role `'MOVER'`:

- **`claimsService.listForParty(actor, query)`**:
  - Automatically queries `{ moverId: actor.sub }` when `actor.role === 'MOVER'`.
  - Movers only see claims opened against them.
- **`reviewsService.listForParty(actor, query)`**:
  - Automatically queries `{ moverId: actor.sub, status: 'PUBLISHED' }` when `actor.role === 'MOVER'`.
- **`replyToReviewAction(reviewId, formData)`**:
  - Allows the mover to post an official reply to reviews.
- **`suggestReplyAction(reviewId)`**:
  - Generates polite AI reply suggestions for the mover (`generateText`).
- **`suggestClaimMessageAction(claimId)`**:
  - Generates cooperative, professional AI response drafts in claim dispute threads.

---

## 5. How to Test as a Mover

1. Log in at `/sign-in` as **Mover 1**:
   - **Email:** `mover@moveup.tn`
   - **Password:** `Demo#2026!`
     _(Or click the 1-click **Mover** demo login button at the bottom of the sign-in card)._
2. Verify that clicking **Claims & Disputes** opens `/dashboard/claims` and displays the claims involving _Mehdi Transport_.
3. Open a claim, scroll to the message box, and click **`✨ Suggest AI reply`**.
4. Verify that clicking **Reviews & Replies** opens `/dashboard/reviews`, shows your 3.5/5 rating average, and allows you to submit or draft replies.
5. Click **View My Public Scorecard** to open `/movers/6adf1d078470fbc93fdc72b5` and test **`GENERATE AI TRUST SCORECARD`**.

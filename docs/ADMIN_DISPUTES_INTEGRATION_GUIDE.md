# MoveUp — Claude Agent Guide: Fixing Admin Disputes, Claim Details & "Update Fails"

> [!IMPORTANT]
> **Instructions for Claude Agent**:
> You are fixing and integrating the **Admin Disputes Desk (`/admin/disputes`)**.
> The issues reported:
>
> 1. Dispute details are incomplete or missing when opening a claim.
> 2. Changing claim priority or running AI shows an error message saying **"Update failed"** or **"could not be generated"**.
>
> Follow the diagnosis and exact solutions below to resolve these immediately.

---

## 1. Root Causes & Immediate Fixes

### Problem A: "Update failed" when changing priority (`PATCH /api/admin/claims/:id`)

- **Cause 1: Missing Route File in Teammate's Branch**  
  The frontend `api.admin.updateClaim(id, payload)` calls `PATCH /api/admin/claims/${id}`. If `app/api/admin/claims/[id]/route.ts` is missing, the request returns `404 Not Found` or `405 Method Not Allowed`, triggering `toast.error("Update failed")`.
- **Cause 2: Authentication Guard Check (`requireAdmin`)**  
  The endpoint requires `role === 'ADMIN'`. If the user is logged in with a non-admin account (or a newly created user whose MongoDB document does not have `role: "ADMIN"`), `requireAdmin` throws `403 Forbidden`.
- **Cause 3: Missing Bearer Header on Browser Refresh**  
  If the access token expired in Zustand, Axios didn't send `Bearer <token>`. _(Member 6 just updated `server/shared/auth/guards.ts` to automatically fall back to the httpOnly session cookie `moveup_refresh` so this never fails anymore!)_

### Problem B: AI Mediation or Draft fails ("AI mediation could not be generated")

- **Cause 1: Missing AI Route Files**  
  The sheet calls `POST /api/ai/claims/${id}/mediate` (`useObject`) and `POST /api/ai/claims/${id}/draft` (`useCompletion`). Both route handlers must exist in the project:
  - `app/api/ai/claims/[id]/mediate/route.ts`
  - `app/api/ai/claims/[id]/draft/route.ts`
- **Cause 2: AI Quota or Missing API Key**  
  If the cloud LLM key is missing or quota is exhausted (`429`), the endpoint must fall back to the deterministic rule engine (`mediateClaimByRules`) instead of crashing. Member 6's route handlers have this built-in.

### Problem C: "Dispute details aren't fully there"

- **Cause:** The admin page is rendering a placeholder or incomplete sheet instead of the complete `<ClaimSheet />` component (`components/features/admin/disputes/claim-sheet.tsx`).

---

## 2. Checklist of Required Files (Make Sure They Exist in Your Branch)

Check that your branch has these exact files from `feat/member6-quality-ai-v2`:

```
app/
├── (admin)/
│   └── admin/
│       └── disputes/
│           └── page.tsx                         # Renders <DisputesPortal />
├── api/
│   ├── admin/
│   │   └── claims/
│   │       ├── route.ts                         # GET /api/admin/claims (Dispute inbox)
│   │       └── [id]/
│   │           └── route.ts                     # GET + PATCH /api/admin/claims/:id (Priority, status, decision)
│   └── ai/
│       └── claims/
│           ├── vision/route.ts                  # POST /api/ai/claims/vision (Multimodal inspection)
│           └── [id]/
│               ├── mediate/route.ts             # POST /api/ai/claims/:id/mediate (AI Dispute Mediator)
│               └── draft/route.ts               # POST /api/ai/claims/:id/draft (AI Resolution Letter)
components/
└── features/
    ├── admin/
    │   └── disputes/
    │       ├── disputes-portal.tsx              # Inbox table + search + filters + mounts <ClaimSheet />
    │       └── claim-sheet.tsx                  # Complete 600-line Arbitration Dossier Sheet
    └── workspace/
        └── evidence-photo-gallery.tsx           # Photo inspection grid + Fullscreen Lightbox with ROI boxes
```

---

## 3. Step-by-Step Code Fixes

### Fix 1: Ensure `app/api/admin/claims/[id]/route.ts` is Present

```ts
// app/api/admin/claims/[id]/route.ts
import { NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { parseBody } from '@/server/shared/http/validate';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { ClaimAdminUpdateSchema, claimsService } from '@/server/modules/claims';

/** GET /api/admin/claims/:id — Loads complete dispute dossier for staff */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json({ claim: await claimsService.getForActor(actor, id) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/admin/claims/:id — Updates priority, status, or records resolution */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    const input = await parseBody(request, ClaimAdminUpdateSchema);
    const claim = await claimsService.adminUpdate(actor, id, input);
    logEvent({
      event: EventType.CLAIM_STATUS,
      userId: actor.sub,
      method: 'PATCH',
      api: `/api/admin/claims/${id}`,
      logInfo: { claimId: id, reference: claim.reference, status: claim.status },
    });
    return NextResponse.json({ claim });
  } catch (error) {
    return errorResponse(error);
  }
}
```

---

### Fix 2: Ensure `server/shared/auth/guards.ts` Supports Cookie Fallback

In `server/shared/auth/guards.ts`, update `requireAuth` so it checks both the Bearer header and the httpOnly session cookie:

```ts
// server/shared/auth/guards.ts
export async function requireAuth(request: Request): Promise<AccessTokenPayload> {
  const tokenUser = await getCurrentUser(request);
  if (tokenUser) {
    const storedUser = await new UserRepository().findOneById(tokenUser.sub);
    if (!storedUser || storedUser.deletedAt) throw new UnauthorizedError();
    if (storedUser.status === 'BLOCKED') throw new ForbiddenError('Account is blocked');
    return { ...tokenUser, email: storedUser.email, role: storedUser.role };
  }

  // Fallback to httpOnly session cookie if Bearer header is missing on page refresh
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
  } catch {
    // Fall through to UnauthorizedError
  }

  throw new UnauthorizedError();
}
```

---

### Fix 3: Mount the Complete `ClaimSheet` in `disputes-portal.tsx`

At the bottom of `components/features/admin/disputes/disputes-portal.tsx`, ensure `<ClaimSheet />` is mounted:

```tsx
import { ClaimSheet } from './claim-sheet';

export function DisputesPortal() {
  const [selected, setSelected] = useState<string | null>(null);
  // ... table rendering ...
  // When a row is clicked: onClick={() => setSelected(claim.id)}

  return (
    <div>
      {/* Table and stats */}

      {/* MUST BE MOUNTED AT THE ROOT OF THE COMPONENT */}
      <ClaimSheet claimId={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
```

---

### Fix 4: Verify the Logged-In User is an ADMIN

Check your MongoDB user to make sure `role` is strictly `"ADMIN"`:

```bash
mongosh "$MONGODB_URI" --eval '
  db.users.updateOne(
    { email: "admin@moveup.tn" },
    { $set: { role: "ADMIN", status: "ACTIVE" } }
  );
'
```

---

## 4. Verification Steps for Claude Agent

Run these verification tests:

1. **Test `PATCH /api/admin/claims/:id` directly:**
   ```bash
   yarn test tests/quality.test.ts
   ```
2. **Sign in as Admin:**
   - Go to `/sign-in`.
   - Use `admin@moveup.tn` / `Admin#2026!`.
3. **Open `/admin/disputes`:**
   - Click on claim `CLM-DEMO-0001`.
   - The **Claim Arbitration Sheet** slides in from the right with:
     - Client statement, Mover details, Move reference.
     - Photographic evidence gallery (click any photo for the Fullscreen Lightbox).
     - Multimodal Vision AI scan (severity, damage rate %, recommended indemnity).
     - AI Triage card.
     - Full Timeline conversation.
     - **AI Dispute Mediator** button (`Run AI Mediator`).
   - Change Priority to **URGENT** in the dropdown → Toast shows **`Priority updated`** (no error!).
   - Click **`Run AI Mediator`** → Live streams settlement proposal and liability split (no error!).

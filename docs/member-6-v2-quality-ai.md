# Member 6 · v2 — Quality domain (claims & reviews) + AI, front **and** back

Teacher's rule for v2: every member ships features on **both sides** (user workspace + admin back
office), front-end and back-end. This slice plugs into the admin shell already on `main`
(`/admin/disputes`, `/admin/customer-reviews` were "not connected" landings) instead of building a
separate admin.

| Side | Client | Mover | Admin |
|---|---|---|---|
| Claims | open a claim, follow it, talk in the thread (`/dashboard/claims`) | see claims about them, answer (`/dashboard/claims`) | inbox + filters, AI triage, status machine, decision with **AI draft** (`/admin/disputes`) |
| Reviews | rate a mover (stars + sub-scores) (`/dashboard/reviews`) | rating summary, public reply with **AI suggestion** (`/dashboard/reviews`) | moderation queue, publish / hide, **streamed AI insights** (`/admin/customer-reviews`) |
| AI assistant | chat with tools over their own data (`/dashboard/assistant`) | same | usage KPIs on `/admin` |
| Public | `/movers/[id]` rating page (ISR) | | |

## Run it

```bash
yarn install                 # adds ai, @ai-sdk/react, @ai-sdk/openai, @ai-sdk/google
cp .env.example .env.local   # optional: OPENAI_API_KEY=... (or AI_PROVIDER=google + GOOGLE_GENERATIVE_AI_API_KEY)
yarn db:seed && yarn db:seed:quality
yarn dev                     # client@moveup.tn / mover@moveup.tn / mover2@moveup.tn → Demo#2026!
yarn test                    # 15 unit tests (state machine, Zod contracts, fallback AI, serializers)
```

Without an AI key everything still works: triage, moderation, drafts and insights fall back to the
deterministic rule engine (`server/modules/ai/ai.fallback.ts`), and the badge says **Rules**.
The chat assistant shows a "not configured" notice.

To test offline mode locally: `NEXT_PUBLIC_ENABLE_SW=true yarn dev` (or `yarn build && yarn start`).

## Architecture (unchanged conventions)

`route.ts` / Server Action (thin: auth → Zod → one service call → audit) → `*.service.ts`
(business rules) → `*.repository.ts` (only file touching Mongoose) → `*.model.ts`.
Serializers whitelist fields per audience (`party` / `author` / `public` / `staff`).

Two full-stack styles side by side (course ch.5):
- **User workspace** → Server Components read data on the server + **Server Actions** for forms
  (`app/(dashboard)/dashboard/actions.ts`), `useActionState` + `useFormStatus`, `revalidatePath`.
- **Admin** → REST route handlers + Axios + **TanStack Query** (the existing back-office pattern).

New endpoints: `GET/POST /api/claims`, `GET /api/claims/:id`, `POST /api/claims/:id/messages`,
`GET/POST /api/reviews`, `POST /api/reviews/:id/reply`, `GET /api/movers`, `GET /api/movers/:id/reviews` (public),
`GET /api/admin/claims`, `GET/PATCH /api/admin/claims/:id`, `GET /api/admin/reviews`, `PATCH /api/admin/reviews/:id`,
`GET /api/admin/quality`, `GET/POST/DELETE /api/ai/chat`, `POST /api/ai/claims/:id/draft`, `POST /api/ai/reviews/insights`.

New audit events: `CLAIM_CREATE`, `CLAIM_MESSAGE`, `CLAIM_STATUS`, `REVIEW_CREATE`, `REVIEW_REPLY`,
`REVIEW_MODERATE`, `AI_REQUEST`.

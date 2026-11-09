# Member 6 · v2 — Quality domain (claims & reviews) + AI, front **and** back

Teacher's rule for v2: every member ships features on **both sides** (user workspace + admin back
office), front-end and back-end. This slice plugs into the admin shell already on `main`
(`/admin/disputes`, `/admin/customer-reviews` were "not connected" landings) instead of building a
separate admin.

| Side         | Client                                                                                                                                                           | Mover                                                                                       | Admin                                                                                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Claims       | open a claim with **Multimodal Vision AI photo scanner** (auto-detects item, material, severity & TND cost), follow it, talk in the thread (`/dashboard/claims`) | see claims about them + Vision AI dossier, answer (`/dashboard/claims`)                     | inbox + filters, AI triage, **AI Dispute Mediator & Compensation Calculator (`streamObject` + `useObject`)**, decision with **AI draft (`useCompletion`)** (`/admin/disputes`) |
| Reviews      | rate a mover (stars + sub-scores) (`/dashboard/reviews`)                                                                                                         | rating summary, public reply with **AI suggestion (`generateText`)** (`/dashboard/reviews`) | moderation queue, publish / hide, **streamed AI insights (`streamObject` + `useObject`)** (`/admin/customer-reviews`)                                                          |
| AI assistant | chat with tools over their own data + live compensation estimator (`useChat` + `streamText` + tools) (`/dashboard/assistant`)                                    | same                                                                                        | usage KPIs on `/admin`                                                                                                                                                         |
| Public       | `/movers/[id]` rating page (ISR)                                                                                                                                 |                                                                                             |                                                                                                                                                                                |

## Run it

```bash
yarn install                 # adds ai, @ai-sdk/react, @ai-sdk/openai, @ai-sdk/google
cp .env.example .env.local   # optional: OPENAI_API_KEY=... (or AI_PROVIDER=google + GOOGLE_GENERATIVE_AI_API_KEY)
yarn db:seed && yarn db:seed:quality
yarn dev                     # client@moveup.tn / mover@moveup.tn / mover2@moveup.tn → Demo#2026!
yarn test                    # 17 unit tests (state machine, Zod contracts, Vision AI, AI Mediator, serializers)
```

Without an AI key everything still works 100% live (ideal for local demos and zero-config Vercel deployments):

- **Multimodal Vision AI (`/api/ai/claims/vision`)** includes 3 one-click demo presets (_Cracked Glass Table_, _Scratched Oak Wardrobe_, _Shattered 55" OLED TV_) plus deterministic vision inspection for custom photos.
- **AI Dispute Mediator (`/api/ai/claims/[id]/mediate`)**, **Review Insights (`/api/ai/reviews/insights`)**, **Resolution Drafts (`/api/ai/claims/[id]/draft`)**, and **MoveUp Assistant (`/api/ai/chat`)** stream progressively in real time using the rule/tool engine when no cloud API key is configured.

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
`GET /api/admin/quality`, `GET/POST/DELETE /api/ai/chat`, `GET/POST /api/ai/claims/vision`,
`POST /api/ai/claims/:id/mediate`, `POST /api/ai/claims/:id/draft`, `POST /api/ai/reviews/insights`.

New audit events: `CLAIM_CREATE`, `CLAIM_MESSAGE`, `CLAIM_STATUS`, `REVIEW_CREATE`, `REVIEW_REPLY`,
`REVIEW_MODERATE`, `AI_REQUEST`.

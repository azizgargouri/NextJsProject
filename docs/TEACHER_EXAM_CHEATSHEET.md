# MoveUp — Teacher Exam & Defense Cheat Sheet (Chapitre 1 à 6)

> [!IMPORTANT]
> **How to use this during your defense:**
> For each question, deliver the **1-Sentence Answer** first so the teacher sees you know the core concept immediately. Then point to the corresponding file in **MoveUp**.

---

## 1. What is a PWA (Progressive Web App)? _(Chapitre 1)_

- **1-Sentence Answer:**  
  A PWA is a website built with web standards (HTML, CSS, JavaScript/React) that delivers a native-like mobile experience: it can be installed on a device's home screen without an App Store, works offline, and loads instantly.
- **The 3 Core Pillars:**
  1. **HTTPS**: Mandatory secure context for Service Workers.
  2. **Web App Manifest (`manifest.json`)**: Configures installability (name, icons, splash screen theme, `display: "standalone"`).
  3. **Service Worker**: Background script managing offline network interception and asset caching.
- **In MoveUp:** Open Chrome DevTools → **Application** tab → show the Manifest and Install prompt.

---

## 2. What is Zod and why do we use it? _(Chapitre 5 & 6)_

- **1-Sentence Answer:**  
  Zod is a TypeScript-first schema declaration and runtime validation library that verifies untrusted inputs (forms, API payloads, LLM responses) and infers TypeScript types automatically.
- **Why it is critical for AI (Vercel AI SDK):**  
  LLMs naturally output unstructured, unpredictable text. By binding a Zod schema to `streamObject` or `generateObject`, the AI engine is mathematically constrained to return the exact typed structure. If a field or type is incorrect, Zod flags it before it reaches your database.
- **In MoveUp:**
  - [`lib/quality/ai-schemas.ts`](file:///Users/mac/Desktop/MoveUp/v2/NextJsProject/lib/quality/ai-schemas.ts) defines `DamageVisionSchema` (enforces numeric damage rates and TND estimates) and `MoverScorecardSchema`.
  - [`server/modules/claims/claims.schema.ts`](file:///Users/mac/Desktop/MoveUp/v2/NextJsProject/server/modules/claims/claims.schema.ts) validates client claim creation before hitting MongoDB.

---

## 3. What is a Service Worker and what are the Cache Strategies? _(Chapitre 3)_

- **1-Sentence Answer:**  
  A Service Worker is an event-driven background script running between the web browser and the network that intercepts outgoing HTTP fetch requests and serves cached responses when offline.
- **The 3 Classic Caching Strategies:**
  1. **Cache First:** Serves from cache immediately; only queries the network if the file is missing (best for static assets: fonts, logos, compiled CSS).
  2. **Network First:** Tries to fetch fresh data from the network; falls back to the cache if the user is offline (best for frequently updated data).
  3. **Stale-While-Revalidate:** Instantly serves the cached copy for zero-latency UI loading, then updates the cache in the background from the network for subsequent visits.
- **In MoveUp:** Offline service worker caching static assets, paired with `localStorage` persistence in the MoveUp AI Assistant (`assistant-chat.tsx`).

---

## 4. What is the App Shell model? _(Chapitre 2)_

- **1-Sentence Answer:**  
  The App Shell model separates the static UI container (header, navigation bar, menus, layout CSS) from dynamic data: the shell is cached locally for instant startup on mobile, while content is streamed into the shell dynamically.
- **In MoveUp:** The sidebar, top bar, and breadcrumbs render immediately; dynamic claim lists and analytics cards stream in asynchronously.

---

## 5. Server Components vs. Client Components (`'use client'`)? _(Chapitre 4)_

- **1-Sentence Answer:**  
  In Next.js App Router, all components are Server Components by default (they execute exclusively on the server, have direct DB access, and ship 0 KB of JavaScript to the browser). A component only requires `'use client'` when it needs browser-only interactivity, React hooks (`useState`, `useEffect`), or DOM event listeners.
- **In MoveUp:**
  - Server Component: [`app/(dashboard)/dashboard/claims/[id]/page.tsx`](file:///Users/mac/Desktop/MoveUp/v2/NextJsProject/app/%28dashboard%29/dashboard/claims/%5Bid%5D/page.tsx) securely queries MongoDB on the server.
  - Client Component: [`components/features/workspace/claim-form.tsx`](file:///Users/mac/Desktop/MoveUp/v2/NextJsProject/components/features/workspace/claim-form.tsx) uses `'use client'` to handle interactive pointer drawing for red damage rectangles (ROI).

---

## 6. What is a Server Action (`'use server'`) vs. a classic REST API? _(Chapitre 5)_

- **1-Sentence Answer:**  
  A Server Action is an asynchronous server function that can be bound directly to form submissions (`<form action={...}>`) without having to manually build API route handlers, write client-side `fetch()` logic, or manage request headers.
- **Key Hooks:**
  - `useFormStatus`: Detects whether the parent form is pending to show button loading spinners.
  - `useActionState`: Manages form state, success messages, and server validation errors.
- **In MoveUp:** [`app/(dashboard)/dashboard/actions.ts`](file:///Users/mac/Desktop/MoveUp/v2/NextJsProject/app/%28dashboard%29/dashboard/actions.ts) (`createClaimAction`, `createReviewAction`, `polishClientReviewAction`).

---

## 7. What is the Vercel AI SDK and why is Streaming essential? _(Chapitre 6)_

- **1-Sentence Answer:**  
  The Vercel AI SDK is a unified TypeScript library that provides provider-agnostic abstractions (`google`, `openai`, `anthropic`) with built-in streaming primitives to deliver tokens to the UI in real time rather than making users wait for an entire LLM completion.
- **Key Primitives:**
  - `streamText` / `useChat`: Streams conversational tokens for interactive assistants.
  - `streamObject` / `useObject`: Streams partial, strongly-typed JSON objects validating against a Zod schema so charts, gauges, and cards animate as the AI generates fields.
- **In MoveUp:**
  - Assistant: `app/api/ai/chat/route.ts` (`useChat` + `streamText`).
  - Dispute Mediator: `app/api/ai/claims/[id]/mediate/route.ts` (`useObject` + `streamObject`).
  - Mover Scorecard: `app/api/ai/movers/[id]/scorecard/route.ts` (`useObject` + `streamObject`).

---

## 8. What is Tool Calling (Function Calling) in AI? _(Chapitre 6)_

- **1-Sentence Answer:**  
  Tool Calling allows an LLM to interact with external databases or APIs: the model chooses which tool to run and with what arguments based on user intent, the server executes that code against the database, and feeds the output back into the model to formulate a grounded response.
- **In MoveUp:** [`server/modules/ai/ai.chat.ts`](file:///Users/mac/Desktop/MoveUp/v2/NextJsProject/server/modules/ai/ai.chat.ts) registers 4 live tools: `getMyClaims`, `getClaimDetails`, `searchMovers`, and `estimateCompensation`.

---

## 9. How do you handle AI quota exhaustion and downtime?

- **1-Sentence Answer:**  
  We implemented a Circuit Breaker pattern with deterministic rule engines: if a cloud provider returns a `429 Quota Exhausted` or network failure, the application opens a cooldown window and serves verified local rule engines and vision fallbacks with zero delay or user crashes.
- **In MoveUp:** [`server/modules/ai/ai.provider.ts`](file:///Users/mac/Desktop/MoveUp/v2/NextJsProject/server/modules/ai/ai.provider.ts) (`isAiAvailable` & `markAiFailure`) and [`server/modules/ai/ai.fallback.ts`](file:///Users/mac/Desktop/MoveUp/v2/NextJsProject/server/modules/ai/ai.fallback.ts).

---

## 10. Quick Summary Matrix (30-Second Glance)

| Topic                | 3-Word Definition          | Where in MoveUp                                    |
| :------------------- | :------------------------- | :------------------------------------------------- |
| **PWA**              | Installable offline app    | `public/manifest.json`, `public/sw.js`             |
| **Zod**              | Runtime schema validator   | `lib/quality/ai-schemas.ts`                        |
| **Service Worker**   | Network interceptor/cache  | `public/sw.js`                                     |
| **Server Action**    | Backend function on form   | `app/(dashboard)/dashboard/actions.ts`             |
| **Server Component** | 0 KB JS server render      | `app/(dashboard)/dashboard/claims/[id]/page.tsx`   |
| **Client Component** | Interactive browser widget | `components/features/workspace/claim-form.tsx`     |
| **`streamObject`**   | Streams typed JSON live    | `app/api/ai/movers/[id]/scorecard/route.ts`        |
| **`useChat`**        | Conversational React hook  | `components/features/workspace/assistant-chat.tsx` |
| **Tool Calling**     | AI querying database       | `server/modules/ai/ai.chat.ts`                     |
| **Circuit Breaker**  | Resilient fallback on 429  | `server/modules/ai/ai.provider.ts`                 |

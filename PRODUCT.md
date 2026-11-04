# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Clients submit one moving request, compare qualified mover responses, follow execution, and rate the completed move.
- Movers receive eligible work, quote, accept or decline assignments, and report progress.
- MoveUp staff use the admin back office to validate movers, manage requests and assignments, handle disputes, and configure operating rules. The product specification distinguishes day-to-day operators from super-admins; the current authentication model exposes one `ADMIN` role.

## Product Purpose

MoveUp is a Tunisian moving-service platform that connects one structured client request to vetted movers while the company supervises the job from intake through completion. Success means less fragmented quoting for clients, reliable demand for movers, and clear operational control for MoveUp staff.

## Positioning

Unlike a simple mover directory, MoveUp keeps the company in the operational loop: movers are vetted, each request has a controlled assignment and quote flow, and progress, evidence, disputes, and outcomes belong to one tracked record.

## Operating Context

The product is one Next.js App Router application with a public site and separate authenticated experiences for clients, movers, and company staff. The first admin delivery covers an overview and user-account management. Future admin work follows specification requirements A-01 through A-11: requests, assignments, mover applications, clients, pricing, disputes, review moderation, content, exports, and audit logs.

## Capabilities and Constraints

- Authentication uses bcrypt passwords, JWT access tokens, rotating hashed refresh tokens, and an httpOnly cookie.
- Roles are `CLIENT`, `MOVER`, and `ADMIN`; users can be `ACTIVE` or `BLOCKED`.
- MongoDB with Mongoose is the persistence layer.
- React Query owns server state, Zustand owns durable client state, Zod validates input, and Axios is the transport boundary.
- `/admin/*` is reserved for authenticated `ADMIN` users. `/dashboard` remains the client/mover workspace.
- The first admin slice must use real stored account data; unavailable move-request and revenue metrics must not be fabricated.

## Brand Commitments

The product name is MoveUp. The public site retains its Swiss Industrial Print identity. The admin back office intentionally uses the compact operational system defined in `BACKOFFICE_UI_ARCHITECTURE.md`: semantic neutral surfaces, one saturated blue accent, dense controls, restrained elevation, and light/dark themes.

## Evidence on Hand

- Product and workflow authority: `Moving-Service-Platform-Specification-Book.docx`.
- Engineering architecture: `NEXTJS_PROJECT_PROMPT.md`.
- Back-office implementation blueprint: `/Users/Apple/Library/Application Support/com.vorssaint.utils/ShelfFiles/B9CADD21-35B4-4428-AFF6-AE935A9AEDAA/BACKOFFICE_UI_ARCHITECTURE.md`.
- Seeded demo accounts exist for ADMIN, CLIENT, and MOVER. No production customer, revenue, request, dispute, or rating data is currently present and none should be invented.

## Product Principles

1. Keep one auditable operational record from request to completed move.
2. Make role and status boundaries explicit and enforce them server-side.
3. Show real operational truth, including honest empty and unavailable states.
4. Keep route files thin and business logic outside visual components.
5. Prefer fast, compact, keyboard-accessible workflows for staff.

## Accessibility & Inclusion

Admin controls must remain keyboard operable, expose visible focus states, preserve accessible names, respect reduced motion, and remain usable from mobile through wide desktop layouts.

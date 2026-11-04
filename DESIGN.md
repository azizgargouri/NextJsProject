# MoveUp Design System

## Identity boundaries

MoveUp has two deliberate visual contexts:

- The public marketing and auth experience keeps the existing Swiss Industrial Print system: newsprint, carbon ink, hazard red, Archivo, JetBrains Mono, and rigid editorial composition.
- The `/admin/*` back office uses a separate operational system based on the supplied Instanct architecture. It is compact, quiet, semantic, and optimized for scanning and repeated work. Never blend the public grain, hazard-red decoration, oversized display type, or marketing motion into admin screens.

## Admin visual contract

### Color

Admin components consume semantic tokens only: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, and matching sidebar tokens. Light and dark values follow `BACKOFFICE_UI_ARCHITECTURE.md`. Saturated blue is the only general-purpose accent. Direct colors are reserved for data visualization.

### Typography

Admin UI uses Verdana with system fallbacks. The normal working size is 14px; table text, labels, badges, and metadata use 12px. Page titles are 20px on mobile and 24px from medium screens. Hierarchy comes from weight and muted color before scale.

### Density and shape

- Base spacing rhythm: 4px.
- Header: 64px.
- Standard controls: 36px; compact controls: 32px.
- Sidebar: 256px expanded, 48px collapsed, 288px mobile sheet.
- Radius: 2px detail, 4px controls, 6px overlays/tables, 10px cards.
- Surfaces are border-first and nearly flat. Cards use one border and a restrained small shadow.
- Circular geometry is limited to avatars, switches, and status indicators.

### Layout and scroll

The admin shell owns the viewport and never relies on body scrolling. Header and sidebar remain fixed within the shell; each feature owns one explicit `overflow-auto` content region. Wide tables scroll horizontally inside their own container. Main horizontal padding is 16px on narrow screens and 40px otherwise.

### Interaction

Sidebar state persists for seven days and toggles with `Cmd/Ctrl + B`. Desktop supports expanded and 48px rail states; mobile navigation uses a focus-managed sheet. Create/edit work belongs in sheets, destructive confirmation in dialogs, and outcomes in themed toasts. Motion communicates state only, lasts roughly 200–300ms, and is disabled or made immediate under reduced motion.

### Components

Buttons, inputs, menus, cards, tables, badges, dialogs, and navigation use shared primitives under `components/ui`. Feature routes remain thin and render feature portals. React Query owns remote data, Zustand is reserved for editable drafts spanning components, Zod validates mutations, and Axios remains outside visual components.

## Admin guardrails

- Do use semantic token utilities and shared primitives.
- Do use dense sticky-header tables, honest loading/empty/error states, and visible focus rings.
- Do keep feature actions in the page header, not the global header.
- Do not use gradients, glass, large shadows, oversized radii, decorative grain, or marketing display typography.
- Do not create dead navigation links; unavailable modules must be visibly marked as upcoming.
- Do not fabricate operational values. Render unavailable data as unavailable and explain the missing module.

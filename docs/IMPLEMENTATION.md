# AI Merge Prompt — Port the RH & Employee Module into `dev`

You are a senior full-stack engineer working in the MoveUp Next.js repository. Your task is to merge the complete RH & employee module from `rh-and-employee-tracking` into `dev` **as a whole**, preserve the newer work already on `dev`, resolve every conflict deliberately, and leave the repo building and verifiable.

Do not rewrite the module from scratch. Port the existing branch.

---

## 1. Repository facts

- Remote: `https://github.com/mAmineSouissi/NextJsProject.git`
- Source branch: `rh-and-employee-tracking` @ `HEAD` (fetch first; it includes the NFT contract upgrade)
- Target branch: `dev` @ `3f7a725` (fetch first; it may be newer)
- Merge base: `5aafdd4` (`main`)
- Source commits, in order:
  1. `66e4d67` — HR/employee tracking module (employees, attendance, leave, reports)
  2. `4aafd0e` — on-chain contracts, crews, location tracking, notebooks
  3. `aec8ea6` — custodial wallets, PDF contracts, profile page, voice check-in
  4. `e5149d0` — server-generated voice challenge + wrong-word RH alerts
  5. `4fc8c78` — listen-before-send voice UI + RH audio playback
  6. `d1807ad` — BSON `Binary` → `Buffer` fix for audio playback
  7. `97020dd` — WebM → 16 kHz mono WAV conversion for the verifier
  8. `b0aeff4` — documentation (this file)
- Net diff vs base: **192 files, +29,857 / −54**
- Expected merge conflicts: **19 files** (listed in §5)

Authoritative file list:

```powershell
git diff --name-status 5aafdd4..HEAD
git diff --stat 5aafdd4..HEAD
```

---

## 2. What must be ported

Port the entire module, not a subset:

| Area | What ships |
| --- | --- |
| HR workspace | stats, headcount, today's attendance, pending leave, contract counts, voice alerts |
| Employees | directory, add/edit employee, auto-created wallet address |
| Attendance | clock-in/out, statuses, history, geofence |
| Leave | employee requests, HR approve/reject |
| Crews & tracking | crews, members, live pings, session stop, history/map |
| Contracts | PDF upload, prepare, propose, employee sign, anchor on-chain as a soulbound ERC721, view PDF, terminate |
| Custodial wallets | server-generated wallets, AES-256-GCM at rest, server-side EIP-712 signing |
| Profile | name, email, wallet address, phone |
| Voice check-in | server challenge, hold-to-record, playback, send, verdict, RH alerts + audio playback |
| Notebooks | speaker verification / voice check-in, geo-fraud analysis |
| Blockchain | `EmploymentContractRegistry.sol`, Hardhat config, deploy/grant/dump scripts, ABI |

### 2.1 Contract NFT model

- Every anchored employment contract mints exactly one **soulbound ERC721** in
  `EmploymentContractRegistry`.
- `tokenId = uint256(contractId)`; the contract record is still stored in the
  registry mapping, so `getContract(contractId)` remains the source of truth.
- The employer is the ERC721 `ownerOf`; the employee is recorded as co-owner.
  `ownersOf(tokenId)` returns both signers and `isContractOwner(account, tokenId)`
  returns true for either of them.
- `tokenURI(tokenId)` returns the contract's `documentUri` (the PDF URI).
- Transfers revert with `ContractNftNonTransferable`; the NFT is a provenance
  record, not a tradable asset. Minting happens automatically inside
  `createContract` and `amendContract`; the app does not send a separate mint
  transaction.
- Keep `lib/blockchain/abi/EmploymentContractRegistry.json` in sync with the
  compiled artifact (`npm run compile && npm run export-abi` in `blockchain/`).

Key entry points: `/dashboard`, `/employees`, `/attendance`, `/leave`, `/contracts`, `/me`, `/profile`, `/api/contracts/*`, `/api/voice/*`, `/api/employees/*`, `/api/attendance/*`, `/api/leave-requests/*`, `/api/crews/*`, `/api/tracking/*`.

---

## 3. Non-negotiable rules

1. **Merge the branch; do not reimplement.** Use `git merge --no-ff`. Cherry-pick only if merging is impossible (see §4.2).
2. **Preserve `dev`'s newer work**: admin back-office, account/profile/password/session APIs, avatar/storage (S3/RustFS), pricing rules, landing content, audit persistence, auth role checks.
3. **Keep `dev`'s `server/shared/auth/guards.ts`.** It is a superset: DB-backed `requireAuth`, `requireRole`, `requireAdmin`. Our routes already call `requireAdmin`/`requireAuth`, so they must compile against `dev`'s implementation.
4. **Union the user model fields**, do not replace them:
   - `dev`: `avatarKey`, `notificationsSeenAt`
   - ours: `walletAddress`, `walletPrivateKeyEncrypted`
5. **Never commit secrets** (`CONTRACT_ADMIN_PRIVATE_KEY`, `WALLET_ENCRYPTION_KEY`, real ngrok token, `.env`). Do not commit `.next`, `node_modules`, `dev-server.log`, or local Mongo test data.
6. **Do not resolve conflicts wholesale** with `git checkout --ours/--theirs` except where explicitly stated (guards, audit, lockfile). Inspect each conflict.
7. **Do not leave `typescript.ignoreBuildErrors: true`** in the merged `next.config.ts`. Remove it and fix type errors; if you must keep it temporarily, say so and run `tsc --noEmit` separately.
8. **Do not silently delete `dev`'s client workspace.** `/dashboard` is a collision; resolve it explicitly (§6).
9. Keep the HR navigation (`HR_NAV` / `SELF_NAV`) and the `adminOnly` guard.
10. Match the existing code style, file layout, and naming. Keep changes scoped to the merge.

---

## 4. Merge procedure

### 4.1 Same repository (recommended)

```powershell
git fetch origin --prune
git checkout rh-and-employee-tracking
git pull --ff-only
git checkout dev
git pull --ff-only
git tag pre-rh-merge
git merge --no-ff rh-and-employee-tracking -m "merge: RH & employee module (wallets, PDF contracts, voice check-in)"
```

Expect 19 conflicts. Resolve them per §5–§6, then:

```powershell
git add -A
git commit
```

### 4.2 If `dev` is a separate repository

If the repos share history, add this repo as a remote and merge:

```powershell
git remote add rh-module https://github.com/mAmineSouissi/NextJsProject.git
git fetch rh-module
git merge --no-ff rh-module/rh-and-employee-tracking
```

If histories are unrelated, use a patch series in commit order:

```powershell
git format-patch 5aafdd4..rh-and-employee-tracking -o ..\rh-patches
git am -3 ..\rh-patches\*.patch
```

Do not reorder commits. `aec8ea6` depends on `66e4d67` + `4aafd0e`; `4fc8c78` depends on `e5149d0`; `97020dd` depends on `4fc8c78`.

### 4.3 Before merging

- Clean working tree; tag/backup `dev`.
- Back up MongoDB (`mongodump`) if the database matters.
- Confirm Node 20+, `yarn`, MongoDB, and the env values in §7.
- Stop `next dev` before building.

---

## 5. Expected conflicts and how to resolve them

| # | File | What each side changed | Resolution |
| --- | --- | --- | --- |
| 1 | `.env.example` | `dev`: Ollama vars. Ours: Web3, wallet, voice vars. | Keep both blocks. Remove the stray trailing `# NEXT_PUBLIC_BLOCK_EXPLORER_URL=` line. |
| 2 | `app/providers.tsx` | `dev`: `ThemeProvider` + `Toaster`. Ours: `WalletProvider`. | Keep `dev`'s providers. **Drop `WalletProvider`** — no component consumes it anymore; contracts use the public RPC. |
| 3 | `components/features/dashboard/dashboard-shell.tsx` | `dev`: hydration fix + `ADMIN → /admin` redirect. Ours: `HR_NAV`/`SELF_NAV` + `adminOnly`. | Keep `dev`'s hydration logic and our nav/adminOnly. Resolve the ADMIN redirect per §6. |
| 4 | `hooks/stores/auth-store.ts` | `dev`: `avatarUrl`. Ours: `walletAddress`. | Keep both fields. |
| 5 | `lib/api/index.ts` | `dev`: `adminApi`, `accountApi`. Ours: HR APIs. | Keep both; export `auth`, `admin`, `account`, `employees`, `contracts`, `attendance`, `leaveRequests`, `reports`, `crews`, `tracking`, `voice`. |
| 6 | `next.config.ts` | `dev`: `devIndicators: false`. Ours: `typescript.ignoreBuildErrors: true`. | Keep `devIndicators`; **remove `ignoreBuildErrors`** and fix type errors. |
| 7 | `package.json` | `dev`: AWS SDK, Radix, `lenis`, `next-themes`, `sonner`. Ours: `ethers@6.13.4`, `leaflet`, `@types/leaflet`. | Union dependencies. |
| 8 | `server/modules/auth/auth.serializer.ts` | `dev`: `avatarUrl`. Ours: `walletAddress`. | Keep both fields in the DTO and serializer. |
| 9 | `server/modules/users/users.repository.ts` | `dev`: admin filters, `findAnyByEmail/Phone`, `findByAvatarKey`, pagination, `returnDocument: 'after'`. Ours: wallet fields, email trim. | Keep `dev`'s methods and our `walletAddress`/`walletPrivateKeyEncrypted` in `UserRow` + `toUserRow`; keep email trim. |
| 10 | `server/modules/users/users.serializer.ts` | `dev`: `avatarUrl`/`avatarUrlFor`. Ours: `walletAddress`. | Keep both. |
| 11 | `server/modules/users/users.service.ts` | `dev`: managed users, status, profile flows. Ours: wallet provisioning in `createUser`. | Keep `dev`'s methods; add `ensureWalletForEmail` in `createUser` and, preferably, `createManagedUser`. |
| 12 | `server/seed.ts` | `dev`: pricing rule + content entries. Ours: `seedHr()` + wallet provisioning. | Keep both; run `seedHr()` after the admin upsert and provision wallets for demo accounts. |
| 13 | `server/shared/auth/guards.ts` | `dev`: DB-backed `requireAuth`, `requireRole`, `requireAdmin`. Ours: `requireAdmin` only. | **Take `dev`'s file wholesale.** Verify our routes still compile. |
| 14 | `server/shared/database/enums.ts` | `dev`: `PRICING_STATUSES`. Ours: employee/attendance/leave/crew/tracking/contract enums. | Union both sets. |
| 15 | `server/shared/database/models/index.ts` | `dev`: `AuditEvent`, `PricingRule`, `ContentEntry`. Ours: HR/contract/tracking models. | Union all exports. |
| 16 | `server/shared/database/models/user.model.ts` | `dev`: `avatarKey`, `notificationsSeenAt`. Ours: wallet fields. | Union all four fields. |
| 17 | `server/shared/logger/audit.ts` | `dev`: persists to `auditevents`. Ours: new `EventType` values, in-memory sink. | **Take `dev`'s persistent implementation** and add our enum values. |
| 18 | `types/index.ts` | `dev`: admin/account/storage/pricing/content types. Ours: HR/contract/voice types. | Union. No duplicate export names were found, but verify. |
| 19 | `yarn.lock` | Both sides updated it. | Take `dev`'s lockfile, then run `yarn install` and commit the regenerated lock. |

Also review auto-merged files for semantic conflicts:
`app/(auth)/sign-in/page.tsx`, `app/(auth)/sign-up/page.tsx`, `components/features/auth/sign-in-form.tsx`, `server/modules/auth/auth.controller.ts`, `server/modules/auth/auth.schema.ts`, `styles/globals.css`.

---

## 6. Critical decisions you must resolve explicitly

### 6.1 ADMIN role collision

`dev` treats `ADMIN` as the back-office admin and redirects `ADMIN` to `/admin`. The HR module also uses `ADMIN` for HR. If you keep the blanket redirect, HR can never open `/dashboard`.

Pick one and document it:

- **Option A (fastest):** keep a single `ADMIN` role. Remove the blanket `ADMIN → /admin` redirect. Keep `adminOnly` on HR pages and add an `/admin` nav link for admins.
- **Option B (least privilege):** add an `isHrAdmin`/department flag (or a dedicated `HR` role) and guard HR routes with it. This touches the role enum, tokens, guards, and seed; only do it if the product needs separation.
- **Recommended for the port:** Option A, then tighten later.

### 6.2 `/dashboard` collision

Our branch replaces `dev`'s client workspace (`app/(dashboard)/dashboard/page.tsx`) with the HR dashboard. Do not silently lose the client workspace. Choose:

- **Option A (recommended):** role-based rendering — `ADMIN` sees the HR dashboard, `CLIENT`/`MOVER` see `dev`'s workspace.
- **Option B:** keep `dev`'s `/dashboard` and mount the HR dashboard at `/hr`; update `HR_NAV`.
- **Option C:** accept the replacement only if the client workspace is confirmed dead.

State which option you chose in the final report.

### 6.3 Legacy MetaMask layer

`components/features/web3/wallet-provider.tsx`, `lib/blockchain/metamask.ts`, `lib/blockchain/ethereum.ts`, and the MetaMask sign functions in `lib/blockchain/registry.ts` are no longer used by the contract UI. Contracts read through the public RPC and sign on the server. You may remove the provider and dead sign helpers, but keep `readContractOnChain` and the public-RPC path working.

### 6.4 `typescript.ignoreBuildErrors`

Remove it. If the merge surfaces many unrelated `dev` type errors, fix the ones caused by the merge and report the rest; do not hide them permanently.

---

## 7. Environment and external services

Add/verify these variables (never commit real values):

| Variable | Purpose |
| --- | --- |
| `WALLET_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM. **Must stay stable**; losing it makes stored wallet keys unrecoverable. |
| `CONTRACT_ADMIN_PRIVATE_KEY` | Funded system wallet that pays gas and should own the registry. |
| `NEXT_PUBLIC_CHAIN_ID` | `80002` for Polygon Amoy. |
| `NEXT_PUBLIC_CHAIN_NAME` | `Polygon Amoy`. |
| `NEXT_PUBLIC_RPC_URL` | `https://rpc-amoy.polygon.technology`. |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Deployed registry address. Current Amoy NFT registry: `0x0a0679eCb1cb60f0CfE28b39FB608f26ee90dd7e`. |
| `NEXT_PUBLIC_BLOCK_EXPLORER_URL` | `https://amoy.polygonscan.com`. |
| `VOICE_API_BASE_URL` | Stable ngrok URL of the Kaggle Flask app. |
| `MONGODB_URI`, `JWT_SECRET`, TTLs, seed vars | Existing app config. |
| `OLLAMA_*` | Keep `dev`'s local AI vars. |

Current registry owner / system wallet (public): `0xF95093Db7d2C58ddb5380645B2E463dCe1a61E2d`.

- If the target environment has no registry, deploy it:
  ```powershell
  cd blockchain
  npm install
  npm run test
  npm run deploy:amoy
  ```
  Then set `NEXT_PUBLIC_CONTRACT_ADDRESS` and fund the system wallet with Amoy POL.
- `ensureHrAdminOnChain` only auto-grants HR wallets if `CONTRACT_ADMIN_PRIVATE_KEY` is the registry owner. Otherwise run `npm run grant:amoy` for each HR wallet/org hash.
- Voice service: open `notebooks/voice_checkin_speaker_verification.ipynb`, replace `<NGROK_AUTHTOKEN>`, Run All, confirm Flask is listening on `:8001`, and set `VOICE_API_BASE_URL`. The tunnel only exists while Kaggle runs.
- `NEXT_PUBLIC_*` values are inlined at build time; restart/rebuild after changing them.

---

## 8. Post-merge setup

```powershell
# 1. Resolve package.json first, then regenerate the lockfile.
#    You are on `dev` merging the source branch, so `--ours` = dev's lockfile.
git checkout --ours yarn.lock
yarn install

# 2. Real type check (next build ignores TS if the flag is left in)
.\node_modules\.bin\tsc.cmd --noEmit

# 3. Stop next dev, clear the build cache, then build
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
yarn build

# 4. Seed demo data
yarn db:seed

# 5. Run
yarn dev
```

Demo accounts:

| Role | Email | Password |
| --- | --- | --- |
| HR admin | `hr@moveup.tn` | `Hr#2026!` |
| Employee | `alice@moveup.tn` | `Demo#2026!` |
| Employee | `bob@moveup.tn` | `Demo#2026!` |
| Employee | `carol@moveup.tn` | `Demo#2026!` |
| Employee | `dave@moveup.tn` | `Demo#2026!` |
| Employee | `eve@moveup.tn` | `Demo#2026!` |

Seed mapping: `hr → ADMIN`, `manager → MOVER`, `employee → CLIENT`.

---

## 9. Verification checklist

Do not declare success until all applicable checks pass.

### Build and type
- [ ] `tsc --noEmit` passes (or every remaining error is documented as pre-existing).
- [ ] `yarn build` passes with `next dev` stopped.
- [ ] `yarn db:seed` completes and prints the HR/employee wallets.

### HR / employee
- [ ] `hr@moveup.tn` signs in and reaches the HR workspace.
- [ ] `/employees` lists the seeded staff with wallet addresses.
- [ ] Creating an employee provisions a wallet.
- [ ] `/profile` shows NAME, EMAIL, WALLET ADDRESS, PHONE; copy and explorer link work.
- [ ] Attendance, leave request, and approve/reject flows work.
- [ ] Crews/tracking endpoints respond and the map renders.

### Contracts / PDF
- [ ] Upload a PDF via `POST /api/contracts/documents`.
- [ ] Prepare/propose a contract; the canonical document contains the PDF attachment.
- [ ] Employee sign and HR anchor complete; status becomes `active`.
- [ ] `View PDF` opens the capability URL.
- [ ] The contract is visible on Amoy PolygonScan.

### Voice
- [ ] `GET /api/voice/challenge` returns a server-generated sentence + code word.
- [ ] Hold-to-record → release → playback → Record again/Send works.
- [ ] Send converts to 16 kHz mono WAV and stores a `voicecheckins` row.
- [ ] A faulty/different-voice attempt appears in `VOICE CHECK-IN ALERTS`.
- [ ] `LISTEN REC` plays the stored clip.
- [ ] Employee token on `/api/voice/checkins` → `403`; anonymous → `401`.

### `dev` regression
- [ ] `CLIENT`/`MOVER` sign-in still works.
- [ ] The client workspace is still reachable (per §6.2).
- [ ] `/admin` back-office, account/profile, pricing, content, and storage routes still work.
- [ ] Existing admin user list/create/status flows still work.

---

## 10. Rollback

- During conflicts: `git merge --abort`.
- Before pushing: `git reset --hard pre-rh-merge`.
- After pushing: `git revert -m 1 <merge-commit>`.
- Database: restore the pre-merge dump, or drop the new collections. Do **not** rotate `WALLET_ENCRYPTION_KEY` if existing wallets must remain readable.

---

## 11. Do not merge / clean up

- `.env`, real private keys, real ngrok token.
- `.next`, `node_modules`, `dev-server.log`.
- Local Mongo test rows (including the 6 voice attempts).
- `blockchain/deployments/localhost.json` if the target has its own deployment; otherwise regenerate it.
- `typescript.ignoreBuildErrors` (remove).
- The legacy MetaMask provider/sign helpers if you confirm nothing uses them.
- `blockchain/README.md` still describes the old MetaMask flow; update it or note that this prompt/implementation is authoritative.

---

## 12. Final response format

When done, report:

1. The merge commit hash and the branch it landed on.
2. Every conflict you resolved and the decision you made (especially §6.1 and §6.2).
3. Any files you intentionally did not port.
4. Commands run and their results (`tsc`, `build`, `seed`, smoke tests).
5. Remaining type errors or known limitations.
6. Anything that needs the human's decision before pushing.

# MoveUp HR — Custodial Wallets, PDF Contracts & Voice Check-In

**Status:** implemented, tested, pushed to `rh-and-employee-tracking`
**Last updated:** 9 November 2026
**Audience:** developers picking up the HR module, reviewers, and anyone running the demo.

---

## Table of contents

1. [What changed and why](#1-what-changed-and-why)
2. [System architecture](#2-system-architecture)
3. [Custodial app wallets](#3-custodial-app-wallets)
4. [Employment contracts with PDF documents](#4-employment-contracts-with-pdf-documents)
5. [Profile page](#5-profile-page)
6. [Voice check-in](#6-voice-check-in)
7. [API reference](#7-api-reference)
8. [Data model](#8-data-model)
9. [Environment variables](#9-environment-variables)
10. [Running the project locally](#10-running-the-project-locally)
11. [Verification performed](#11-verification-performed)
12. [Troubleshooting](#12-troubleshooting)
13. [Security notes](#13-security-notes)
14. [Git history](#14-git-history)
15. [Known limitations and next steps](#15-known-limitations-and-next-steps)

---

## 1. What changed and why

The HR module originally assumed every user had MetaMask: HR and employees
connected a browser wallet, signed EIP-712 intents themselves, and a system
wallet paid the gas. That is a poor fit for an HR product where staff should not
need a crypto wallet at all.

This work replaces that with:

| Area | Before | Now |
| --- | --- | --- |
| Wallets | MetaMask per user | Server-generated **custodial wallets** per HR/employee account |
| Contract creation | HR typed/connected wallet addresses | Addresses come from the database only |
| Contract document | JSON URI / "Download JSON" | **PDF upload**, stored in MongoDB, opened via capability URL |
| Wallet address in UI | Contracts page + explanation panel | **Profile page** (below email, above phone) |
| Attendance | GPS "check in" card | **Voice check-in** (hold to record, listen back, send) |
| Spoken challenge | Client-generated random words | **Server-generated** 3-word sentence + code word |
| Faulty attempts | Not visible to HR | **RH voice alerts** with the recorded clip playable |
| Voice verification | Local mock | Kaggle notebook (speaker model + Whisper) exposed via stable ngrok URL |

No private key ever reaches the browser. The API exposes only public addresses.

---

## 2. System architecture

```
┌──────────────────────────── Browser ────────────────────────────┐
│  /dashboard (HR)   /me (employee)   /contracts   /profile       │
│  Next.js App Router + Zustand auth store + TanStack Query       │
└───────────────┬─────────────────────────────────────────────────┘
                │ HTTPS (Bearer access token)
┌───────────────▼─────────────────────────────────────────────────┐
│                     Next.js API routes (server)                  │
│  /api/contracts/*        /api/voice/*        /api/auth/*         │
│  custodial signing       proxy + persistence                    │
└───────┬──────────────────────┬──────────────────────┬───────────┘
        │                      │                      │
┌───────▼────────┐   ┌─────────▼─────────┐   ┌────────▼──────────┐
│    MongoDB     │   │  Polygon Amoy     │   │  Kaggle + ngrok   │
│ users, staff,  │   │ EmploymentContract│   │ Flask voice API   │
│ contracts,     │   │ Registry (EVM)    │   │ speaker + Whisper │
│ PDFs, voice    │   │ dual signatures   │   │ /health           │
│ attempts       │   │ + document hash   │   │ /api/voice/checkin│
└────────────────┘   └───────────────────┘   └───────────────────┘
```

**Key principle:** MongoDB is a fast query mirror. For contracts, the chain is
the source of truth — the server re-reads the receipt and the on-chain record
before writing Mongo.

---

## 3. Custodial app wallets

### 3.1 Design

- Every `User`/`Employee` gets an Ethereum wallet generated **on the server**.
- The private key is encrypted at rest with **AES-256-GCM** using
  `WALLET_ENCRYPTION_KEY`.
- Stored payload format: `v1:<iv-base64>:<authTag-base64>:<ciphertext-base64>`.
- The API returns only the public address (`walletAddress`).
- When a contract needs a signature, the server decrypts the key in memory,
  signs the EIP-712 intent, and discards it. Nothing is sent to the client.

Implementation: `server/shared/wallet/custodial.ts`

```ts
generateCustodialWallet()            // address + encryptedPrivateKey
encryptPrivateKey(privateKey)        // AES-256-GCM
decryptPrivateKey(encrypted)         // server-only
signTypedDataWithEncryptedKey(...)   // EIP-712 signing
```

### 3.2 Provisioning

Wallets are created lazily and idempotently by:

- `ensureWalletForEmail(email)` — HR/admin accounts
- `ensureEmployeeWalletById(employeeId)` — employee records
- the seed script, for demo accounts

Both `User` and `Employee` documents store `walletAddress` and
`encryptedPrivateKey`. Re-running provisioning never rotates an existing key.

### 3.3 Who signs what

| Step | Signer | Where the key lives |
| --- | --- | --- |
| HR creates a proposal | Employer (HR custodial wallet) | Server, encrypted |
| Employee accepts | Employee custodial wallet | Server, encrypted |
| Anchor on-chain | System wallet (`CONTRACT_ADMIN_PRIVATE_KEY`) | Server env, pays gas |

The HR and employee signatures are **gasless**. Only the system wallet spends
POL.

### 3.4 HR admin authorization on-chain

The registry only accepts contracts from wallets authorised as HR admins for an
organisation. The server calls `ensureHrAdminOnChain(hrWallet, orgHash)` before
anchoring, so the first contract for a new HR account self-authorises when
`CONTRACT_ADMIN_PRIVATE_KEY` is the registry owner.

---

## 4. Employment contracts with PDF documents

### 4.1 Flow

```
HR                         Server                          Chain
 │  upload PDF               │                               │
 │ ─────────────────────────▶│ store bytes + keccak256       │
 │                           │                               │
 │  prepare (employee id,    │ build canonical document,     │
 │  PDF documentId, terms)   │ hash, nonce, deadline         │
 │ ─────────────────────────▶│ sign as employer              │
 │                           │                               │
 │  create proposal          │ proposal = awaiting_employee  │
 │ ─────────────────────────▶│                               │
 │                           │                               │
 │                  Employee │ signs with custodial wallet   │
 │                           │ (server-side, gasless)        │
 │                           │                               │
 │  anchor                   │ system wallet sends           │
 │ ─────────────────────────▶│ createContract(intent, doc,   │
 │                           │   employerSig, employeeSig)   │
 │                           │ ─────────────────────────────▶│ verifies BOTH
 │                           │                               │ stores doc+hash
 │                           │ re-reads receipt + on-chain   │
 │                           │ record, then writes Mongo     │
```

### 4.2 EIP-712 intent

Both parties sign the same typed data (`ContractIntent`):

| Field | Meaning |
| --- | --- |
| `organizationId` | keccak256 of the organisation id |
| `employer` | HR custodial wallet address |
| `employee` | employee custodial wallet address |
| `employeeRefHash` | keccak256 of `EMP00x` |
| `documentHash` | keccak256 of the canonical document bytes (includes the PDF hash) |
| `startDate`, `endDate` | unix seconds |
| `previousContractId` | renewal chain |
| `version` | incremented per renewal |
| `nonce` | replay protection |
| `deadline` | signature expiry (7 days) |

Domain: registry name/version, `chainId`, `verifyingContract`.
Type definitions: `types/index.ts` (`ContractIntentTypedData`).

### 4.3 PDF storage

- `POST /api/contracts/documents` (HR only, `multipart/form-data`, field `file`)
- Only PDFs are accepted; the service validates the magic bytes and size.
- Bytes are stored in MongoDB collection **`contract-document-files`**.
- The response returns a document id + metadata; the canonical contract embeds
  `attachment: { documentId, fileName, byteLength, sha256, url }`.
- `keccak256(pdfBytes)` is part of the canonical document, so the on-chain
  `documentHash` covers the PDF.
- `GET /api/contracts/documents/[id]` serves the PDF inline. The id is an
  unguessable UUID acting as a **capability URL**, so a plain link can open the
  PDF without putting a Bearer token in the URL.

### 4.4 UI changes

- `components/features/contracts/create-contract-form.tsx`
  - PDF file picker replaces the URI/JSON input.
  - No wallet address fields: both addresses come from the DB.
  - Uploads the PDF first, then calls `prepare` with `documentId`.
- Contract cards show **View PDF** (opens the capability URL) instead of
  "Download JSON".

### 4.5 Deployment

- Registry: `blockchain/contracts/EmploymentContractRegistry.sol`
- Polygon Amoy address: `0xBEBf6067E65Cd53aF37B0033bA9099D0Ed71559f`
- Registry owner / system wallet: `0xF95093Db7d2C58ddb5380645B2E463dCe1a61E2d`
- `NEXT_PUBLIC_CHAIN_ID=80002`

---

## 5. Profile page

Route: `/profile` (`app/(dashboard)/profile/page.tsx`)

- Shows **NAME**, **EMAIL**, **WALLET ADDRESS**, **PHONE**.
- Wallet address sits between email and phone.
- Copy-to-clipboard + PolygonScan link (`NEXT_PUBLIC_BLOCK_EXPLORER_URL`).
- Role is not displayed.
- The old wallet explanation panel (`wallet-panel.tsx`) was deleted.
- Nav includes Profile for both HR and employees.

---

## 6. Voice check-in

### 6.1 End-to-end flow

```
Employee /me                     Next.js API                    Kaggle (ngrok)
     │                                │                              │
     │ GET /api/voice/challenge       │                              │
     │ ──────────────────────────────▶│ picks challenge + 2 words    │
     │ ◀──────────── { challenge, sentence } ────────────────────────│
     │                                │                              │
     │ hold button, speak sentence    │                              │
     │ release → local playback       │                              │
     │ choose Record again / Send     │                              │
     │                                │                              │
     │ POST /api/voice/checkin        │                              │
     │  { audio_b64(WAV), transcript, │                              │
     │    job_id, challenge, lat,lng }│                              │
     │ ──────────────────────────────▶│ forward JSON                 │
     │                                │ ────────────────────────────▶│ decode WAV
     │                                │                              │ speaker score
     │                                │                              │ challenge/job
     │                                │ ◀──────── verdict JSON ──────│
     │                                │ persist attempt + audio      │
     │ ◀──────── verdict ─────────────│                              │
     │                                │                              │
     │ HR /dashboard                  │                              │
     │ GET /api/voice/checkins        │                              │
     │ ──────────────────────────────▶│ mismatches + LISTEN REC      │
```

### 6.2 Server-generated challenge

`GET /api/voice/challenge` (authenticated):

- Picks one challenge word from
  `Tunis, Sfax, Bizerte, Sousse, Nabeul, Kairouan`.
- Picks two other words from a fixed vocabulary (`mover`, `job`, `checkin`, …).
- Shuffles the three words → `sentence`.
- Returns `{ challenge, sentence }`.

The employee reads the sentence. The code word is displayed read-only; it cannot
be edited in the UI. The sentence field remains editable (per product decision)
so a wrong spoken/typed word can be verified and reported.

### 6.3 Recording UX (`components/features/hr/my-workspace-view.tsx`)

1. **HOLD TO RECORD** — `pointerdown` starts `MediaRecorder`.
2. **RELEASE TO LISTEN** — `pointerup` stops; the take is **not** sent yet.
3. Playback card appears with:
   - an `<audio controls>` preview of the take,
   - **Record again** (discards),
   - **Send for verification**.
4. Only **Send** converts the audio and calls the verifier.
5. While waiting: **VERIFYING…**; the verdict is shown as
   `ACCEPT/REVIEW/REJECT · speaker score · label · threshold · reasons`.

The old GPS "TODAY'S ATTENDANCE / CHECK IN" card was removed; the voice section
is the attendance card.

### 6.4 Audio format: WebM → 16 kHz mono WAV

**Why:** `MediaRecorder` produces WebM/Opus. The Kaggle endpoint decodes with
Python `soundfile` (`libsndfile`), which cannot read WebM — it throws
`Format not recognised`. Without conversion, every real check-in would 500 and
RH would receive nothing.

**Fix:** `lib/audio/wav.ts`

- `convertToWav16k(blob)`:
  1. `AudioContext.decodeAudioData` decodes the take.
  2. `OfflineAudioContext(1, frames, 16000)` renders mono 16 kHz.
  3. `encodeWavPcm16` writes a 44-byte RIFF header + 16-bit PCM samples.
- The browser sends `audio/wav`; the proxy sniffs the magic bytes
  (`RIFF....WAVE`) and stores the correct MIME type.
- The stored clip is therefore also directly playable by HR.

Verified: a 3 s MediaRecorder WebM (16,480 bytes, 48 kHz) becomes a 96,044-byte
WAV that `soundfile` reads as `16000 Hz, 3.00 s, float32`.

### 6.5 Proxy and persistence

`POST /api/voice/checkin`:

1. `requireAuth` (Bearer token).
2. Forwards the JSON body to `${VOICE_API_BASE_URL}/api/voice/checkin`.
3. Persists **every attempt** in `voicecheckins`:
   - `employeeRef`, `decision`, `speakerScore`, `voiceLabel`,
     `challengeOk`, `jobOk`, `distanceM`, `reasons`
   - `audio` (Buffer) + `mimeType`
4. Persistence is best-effort: a DB failure never fails the check-in.
5. If the verifier returns a non-JSON/HTML response, the row is still stored
   with `decision: 'unknown'` (useful for diagnosing a broken tunnel).

`GET /api/voice/checkin` is a health probe that forwards to the Kaggle `/health`.

### 6.6 RH alerts and playback

`GET /api/voice/checkins` (admin only) returns the last 50 attempts.

The dashboard section **VOICE CHECK-IN ALERTS**
(`components/features/hr/dashboard-view.tsx`) filters rows where:

- `decision === 'reject'`, or
- `voiceLabel === 'different_voice'`, or
- any reason mentions `voice`, `different`, or `challenge`.

Each mismatch shows employee ref, score, label, decision, timestamp and reasons,
plus **LISTEN REC**. The button fetches
`GET /api/voice/checkins/[id]/audio` with the Bearer token (an `<audio src>` cannot
send headers), turns the response into an object URL, and plays it inline.

The audio route is **admin-only**; employees and anonymous requests get
`403`/`401`.

### 6.7 Kaggle voice service

Notebook: `notebooks/voice_checkin_speaker_verification.ipynb` (31 cells)

- Speaker model: `speechbrain/spkrec-ecapa-voxceleb` (falls back to MFCC).
- ASR: `openai/whisper-tiny` (used in the notebook analysis).
- Flask app on port **8001**:
  - `GET /health` → `{ ok, engine, threshold }`
  - `POST /api/voice/checkin` → decodes WAV with `soundfile`, computes the
    speaker score, parses the transcript, applies geofence/challenge rules and
    returns `accept | review | reject` + reasons.
- Exposed with the stable ngrok domain
  `https://paloma-cranelike-kathrin.ngrok-free.dev`.
- The notebook currently contains the placeholder `<NGROK_AUTHTOKEN>`; replace it
  with a real token (or load it from a Kaggle secret) before running.

> The tunnel only exists while the Kaggle session is running. Restarting Kaggle
> kills it; rerunning the last cell reconnects the same stable domain.

### 6.8 Trust model (important)

The Flask endpoint currently trusts the `transcript` field sent by the client.
It does **not** transcribe the uploaded audio inside `/api/voice/checkin`
(Whisper is loaded in the notebook but only used for the analysis cells).

Consequences:

- A faulty **voice** is detected from the audio embedding (real).
- A wrong **word** is only detected if the transcript text differs; a client
  could send the correct word while saying something else.
- The 3-word server sentence does not contain a check-in intent or a job name,
  so `parse_command` adds `no_check_in_intent` / `job_not_recognised` and the
  verdict is `reject` even for a correct voice.

For a stricter design, run ASR on the uploaded audio inside the endpoint and
derive the challenge check from the ASR text (see
[Known limitations](#15-known-limitations-and-next-steps)).

---

## 7. API reference

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/sign-in` | public | Email/password → access token + refresh cookie |
| `POST` | `/api/auth/refresh-token` | cookie | Rotate the access token |
| `GET` | `/api/auth/me` | user | Current session |
| `POST` | `/api/contracts/documents` | admin | Upload contract PDF (`multipart`, field `file`) |
| `GET` | `/api/contracts/documents/[id]` | capability URL | Serve the PDF inline |
| `POST` | `/api/contracts/prepare` | admin | Build + hash canonical contract, employer signature |
| `POST` | `/api/contracts/proposals` | admin | Create proposal (`awaiting_employee`) |
| `POST` | `/api/contracts/proposals/[id]/sign` | employee | Custodial employee signature |
| `POST` | `/api/contracts/proposals/[id]/anchor` | admin | System wallet writes to chain |
| `GET` | `/api/contracts` | user | List contracts (HR: org, employee: own) |
| `GET` | `/api/voice/challenge` | user | Server-generated sentence + code word |
| `GET` | `/api/voice/checkin` | user | Proxy Kaggle `/health` |
| `POST` | `/api/voice/checkin` | user | Verify a recording, persist the attempt |
| `GET` | `/api/voice/checkins` | admin | Last 50 attempts for RH alerts |
| `GET` | `/api/voice/checkins/[id]/audio` | admin | Play back a stored recording |

---

## 8. Data model

### 8.1 `VoiceCheckin` (`voicecheckins`)

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | ObjectId | Auth user who attempted |
| `employeeId` | ObjectId \| null | Employee profile |
| `employeeRef` | string | e.g. `EMP001` |
| `decision` | string | `accept`, `review`, `reject`, `unknown` |
| `speakerScore` | number | Cosine similarity |
| `voiceLabel` | string | `same_voice`, `review`, `different_voice`, `unknown` |
| `challengeOk` | boolean | Challenge word matched |
| `jobOk` | boolean | Job recognised |
| `distanceM` | number | Geofence distance |
| `reasons` | string[] | Machine-readable reasons |
| `audio` | Buffer | Raw recording (WAV now, older rows WebM) |
| `mimeType` | string | `audio/wav` or `audio/webm` |
| `createdAt` | Date | Timestamp |

### 8.2 Contract document (`contract-document-files`)

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | UUID/string | Capability URL id |
| `organization` | ObjectId | Owning HR org |
| `uploadedBy` | ObjectId | HR user |
| `fileName` | string | Original name |
| `mimeType` | string | `application/pdf` |
| `byteLength` | number | Size |
| `sha256` | string | Hash of the bytes |
| `data` | Buffer | PDF bytes |
| `createdAt` | Date | Upload time |

### 8.3 Wallet fields

`User` and `Employee` both carry:

| Field | Notes |
| --- | --- |
| `walletAddress` | Lower-case public address |
| `encryptedPrivateKey` | `v1:iv:tag:ciphertext` (AES-256-GCM) |

---

## 9. Environment variables

Copy `.env.example` → `.env` and fill the secrets.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Access-token signing key |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL` | Token lifetimes (seconds) |
| `NEXT_PUBLIC_CHAIN_ID` | `80002` for Polygon Amoy |
| `NEXT_PUBLIC_RPC_URL` | Amoy RPC endpoint |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Deployed registry address |
| `NEXT_PUBLIC_BLOCK_EXPLORER_URL` | PolygonScan base URL |
| `CONTRACT_ADMIN_PRIVATE_KEY` | System wallet: pays gas, registry owner |
| `WALLET_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM |
| `VOICE_API_BASE_URL` | Stable ngrok URL of the Kaggle Flask app |

> **`WALLET_ENCRYPTION_KEY` is critical.** Losing it makes every stored wallet
> key unrecoverable. Generate it with
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
> and keep it out of git.

---

## 10. Running the project locally

### Prerequisites

- Node.js 20+
- MongoDB running on `localhost:27017`
- A Kaggle session running the notebook (for real voice verification)
- Polygon Amoy RPC (or local Hardhat)

### Steps

```powershell
# 1. Install
npm install

# 2. Configure
Copy-Item .env.example .env
# fill JWT_SECRET, WALLET_ENCRYPTION_KEY, CONTRACT_ADMIN_PRIVATE_KEY,
# NEXT_PUBLIC_CONTRACT_ADDRESS, VOICE_API_BASE_URL

# 3. Seed demo data (idempotent)
npm run seed

# 4. Run
npm run dev
```

Demo accounts (from `server/seed.ts`):

| Role | Email | Password |
| --- | --- | --- |
| HR admin | `hr@moveup.tn` | `Hr#2026!` |
| Employee | `alice@moveup.tn` | `Demo#2026!` |
| Employee | `bob@moveup.tn` | `Demo#2026!` |
| Employee | `carol@moveup.tn` | `Demo#2026!` |

### Voice service

1. Open the notebook in Kaggle and Run All.
2. Set the ngrok token (the notebook has `<NGROK_AUTHTOKEN>` placeholder):
   - hardcode it temporarily, or
   - use a Kaggle secret:
     ```python
     from kaggle_secrets import UserSecretsClient
     NGROK_TOKEN = UserSecretsClient().get_secret("NGROK_AUTHTOKEN")
     ```
3. Confirm the last cell prints:
   - `Local server on http://0.0.0.0:8001`
   - `Stable URL: https://paloma-cranelike-kathrin.ngrok-free.dev`
4. Verify from the host:
   ```powershell
   curl.exe -H "ngrok-skip-browser-warning: true" https://paloma-cranelike-kathrin.ngrok-free.dev/health
   ```
   Expected: `{"ok": true, ...}`.

### Blockchain (optional, local)

```powershell
cd blockchain
npm run node          # terminal A
npm run deploy:local  # terminal B
```

Then point `NEXT_PUBLIC_CHAIN_ID=31337`, `NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545`
and `NEXT_PUBLIC_CONTRACT_ADDRESS` at the local deployment.

---

## 11. Verification performed

### 11.1 Contracts (Polygon Amoy)

- `ensureHrAdminOnChain` verified on-chain: HR wallet went `false → true`.
- Full E2E: HR `hr@moveup.tn` → Carol `carol@moveup.tn` (`EMP003`).
  - Contract id: `0x6807c2c0a4647b8a031f914b0e60f64ff72f142393b2f455303e542bea31b79a`
  - Create tx: `0xbca8918551f697045eb043309d697bc674ca33196e109e8beb88e9d38f8306cd`
  - Status: `active`
- Earlier local Hardhat E2E for Alice (`EMP001`):
  - Contract: `0x7b8e66d1ec42007eedd9cbdd46f11522fe85a19a38c438925f4661c881a90e6d`

### 11.2 PDF upload

- Upload → store → `prepare` with `documentId` → canonical document contains
  `attachment` → PDF opens from the contract card via the capability URL.

### 11.3 Voice check-in

Tested with a real MediaRecorder WebM and the browser-converted WAV:

| Check | Result |
| --- | --- |
| Employee sign-in | OK (`alice@moveup.tn`) |
| `POST /api/voice/checkin` (faulty WAV) | `200` → `reject · different_voice · wrong_challenge` |
| HR feed shows the faulty row | OK |
| `GET .../[id]/audio` (HR) | `200 · audio/wav · 96,044 bytes` |
| Stored bytes vs sent bytes | SHA-256 identical |
| Employee token on audio | `403` |
| Anonymous on feed | `401` |
| Browser playback | 3.0 s clip, `readyState 4`, no decode error |
| RH dashboard | shows mismatch count and `LISTEN REC` |

The Kaggle backend itself was simulated during the last test with a local Flask
stand-in that decodes the payload using **`soundfile`** exactly like the
notebook. It reported:

```
decoded 96044 bytes -> 16000 Hz, 3.00s
```

This proves the browser payload is readable by the real verifier. A live Kaggle
run is still required to validate the model verdict itself.

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ERR_NGROK_6024` on the ngrok URL | Agent not connected | Start the notebook's ngrok cell; set a valid token |
| `502 failed to dial backend: Connection timed out` | Tunnel is up but Flask is not listening on `:8001` | Restart the Kaggle kernel and Run All; check the last cell for `Address already in use` or a traceback |
| Voice row saved with `decision: unknown` | Verifier returned non-JSON/HTML (tunnel page, 500) | Fix the backend; the row is kept for diagnosis |
| `soundfile` / `Format not recognised` | WebM sent instead of WAV | Use the browser WAV conversion (`lib/audio/wav.ts`) |
| Audio playback `500` | Mongoose `.lean()` returns a BSON `Binary`; `.length` is a function → invalid `Content-Length` | Fixed by `toBuffer()` in the audio route |
| `Cannot read properties of undefined (reading '/_app')` | `next build` ran while `next dev` was using the same `.next` | Stop dev, delete `.next`, restart dev |
| `npx.ps1 cannot be loaded` (PowerShell) | Execution policy | Use `.\node_modules\.bin\<tool>.cmd` |
| `EADDRINUSE :::3000` | Another dev server is running | Kill the process on port 3000 or use `--port 3001` |
| Contract anchor fails `NotHrAdmin` | HR wallet not authorised | Make `CONTRACT_ADMIN_PRIVATE_KEY` the registry owner, or run the grant script |

---

## 13. Security notes

- **Private keys never leave the server.** Only public addresses are serialised.
- **AES-256-GCM** with a 32-byte key; payloads are versioned (`v1:`).
- **Capability URLs** for PDFs are unguessable UUIDs; they do not embed tokens.
- **Voice audio is biometric data.** The demo stores the clip so HR can audit a
  faulty check-in. For production, obtain consent, define retention, and
  restrict access (the endpoint is already admin-only).
- **The ngrok token was scrubbed** from the notebook before pushing; it is now a
  placeholder. Never commit real tokens or private keys.
- **The system wallet key** (`CONTRACT_ADMIN_PRIVATE_KEY`) pays gas and owns the
  registry. Treat it as a production secret; consider a KMS/HSM in production.
- **Custodial wallets are a deliberate demo choice.** For production, prefer a
  wallet-as-a-service or non-custodial embedded wallet with user recovery.

---

## 14. Git history

Branch: `rh-and-employee-tracking`

| Commit | Description |
| --- | --- |
| `aec8ea6` | Custodial app wallets, PDF contracts, profile page, voice check-in |
| `e5149d0` | Server-generated voice challenge with wrong-word alerts for RH |
| `4fc8c78` | Listen-before-send voice check-in and RH audio playback for faulty attempts |
| `d1807ad` | Serve stored voice recordings by converting BSON Binary to Buffer |
| `97020dd` | Send 16 kHz mono WAV to the voice verifier (soundfile cannot read WebM) |

---

## 15. Known limitations and next steps

1. **Kaggle tunnel lifetime** — the URL is stable, but the service only exists
   while the notebook runs. A production deployment should host the verifier on
   a always-on service (FastAPI + container) rather than Kaggle + ngrok.
2. **Transcript trust / ASR gap** — the endpoint verifies the client-supplied
   transcript, not the spoken audio. Recommended fix: run Whisper on the
   uploaded WAV inside `/api/voice/checkin` and derive `challenge_ok` from the
   ASR text. This is the only way "wrong word" is truly verified.
3. **Intent/job parsing vs. 3-word sentence** — `parse_command` expects a
   check-in intent and a job name/area. The server sentence contains neither, so
   a correct voice still rejects with `no_check_in_intent` and
   `job_not_recognised`. Align the challenge sentence with the parser (e.g.
   include `check in <area> code <word>`) or relax those checks for this flow.
4. **Audio retention** — clips are stored indefinitely in MongoDB. Add a TTL or
   an explicit retention policy before production.
5. **Old WebM rows** — records created before the WAV change remain WebM. They
   play in Chrome but may not decode in Safari; new rows are WAV.
6. **Storage size** — WAV is ~6× larger than WebM (96 KB vs 16 KB for 3 s).
   Fine for short clips; consider Opus-in-Ogg if the verifier is updated.
7. **MetaMask documentation** — `blockchain/README.md` still describes the old
   browser-wallet flow. The current implementation is custodial (this document
   is authoritative).

---

*End of document.*

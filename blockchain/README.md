# Dual-signed on-chain employment contracts (MetaMask)

This folder contains the Solidity registry used by the MoveUp HR app. The
Next.js side is wired to `/contracts`: HR prepares a contract and co-signs it,
the employee reviews the exact JSON and co-signs the same EIP-712 intent
(signature only — no gas), then a backend system wallet sends the anchor
transaction and pays for it, so neither HR nor the employee ever needs a funded
wallet. The registry refuses to write anything unless **both** signatures are
valid.

> **Privacy warning:** the full canonical contract JSON is stored in contract
> storage and in the transaction calldata. Names, emails and salary therefore
> become public on a public network. This is intentional (the contract survives
> the database), but do not deploy it to mainnet as-is if those terms must stay
> private. Encrypt the document before signing or use a private/permissioned
> chain.

## What is stored where

| Data | Location | Why |
| --- | --- | --- |
| Full canonical contract JSON | Blockchain (storage + calldata) | Durable even if MongoDB is lost |
| HR signature + employee signature | Blockchain | Proof that both parties agreed |
| Document hash (`keccak256` of canonical JSON) | Blockchain | Fast integrity check |
| Employee / employer wallet addresses | Blockchain | Who is bound |
| Dates, version, nonce, deadline, status, reason hash | Blockchain | Lifecycle and signature audit trail |
| Queryable mirror, private directory links | MongoDB | Fast app lists and joins |

The database is a convenience mirror. It is **not** the source of truth: the
server re-reads the receipt and the on-chain record before writing Mongo.

## Signing model

```
HR browser (MetaMask)                         Employee browser (MetaMask)
      │                                                   │
      │ 1. prepare: server builds canonical JSON           │
      │    hashes it, creates nonce + 7-day deadline      │
      │                                                   │
      │ 2. HR signTypedData(ContractIntent)                │
      │    (no gas, no transaction)                        │
      │                                                   │
      │ 3. propose: server stores HR signature             │
      │ ───────────── proposal in MongoDB ───────────────▶ │
      │                                                   │ 4. review exact JSON
      │                                                   │ 5. employee signTypedData
      │                                                   │    (same intent)
      │ ◀─────────── employee signature ───────────────── │
      │                                                   │
      │ 6. system wallet sends createContract(             │
      │      intent, document,                             │
      │      employerSig, employeeSig)                     │
      │    (system wallet pays; no app user spends gas)    │
      │                                                   │
      │                         EmploymentContractRegistry
      │                         verifies BOTH signatures
      │                         stores document + signatures
      │                                                   │
      │ 7. record: server verifies receipt + on-chain doc  │
      ▼                                                   ▼
                        MongoDB mirror (optional)
```

The EIP-712 intent includes the organisation hash, both wallets, employee ref
hash, document hash, start/end dates, previous contract id, version, a random
nonce and a deadline. Changing any field invalidates both signatures.

## Contract-enforced rules

- `createContract` verifies the HR signature and the employee signature before
  storing anything. A successful call can never store a one-sided employment
  contract. `msg.sender` is not restricted: any account can submit, and the
  app uses a dedicated system wallet so no app user ever needs gas.
- The document must hash to the `documentHash` both parties signed.
- The HR wallet must be authorized for the intent's organisation on-chain.
- The signature deadline must not have passed.
- The nonce makes the intent single-use; replaying it reverts with
  `ContractAlreadyExists`.
- Documents are capped at 16 KB (`MAX_DOCUMENT_BYTES`) so a mistaken PDF cannot
  create an unusable transaction.
- `amendContract` also requires a fresh dual signature for the new version.
- `terminateContract` needs a signed `Termination` intent from an authorised HR
  wallet (dismissal) or from the employee (resignation). Any account — normally
  the app's system wallet — submits it and pays the gas.

## Repository layout

```
blockchain/
  contracts/EmploymentContractRegistry.sol   # dual-signature registry
  test/EmploymentContractRegistry.test.ts    # 25 Hardhat tests
  scripts/deploy.ts                          # deploy + optional HR grant
  scripts/grant-hr-admin.ts                  # authorize an HR wallet
  scripts/export-abi.ts                      # copy ABI into lib/blockchain/abi
  scripts/dump-contracts.ts                  # recover contracts from chain only
  hardhat.config.ts
  .env.example

app/(dashboard)/contracts/page.tsx           # /contracts workspace
app/api/contracts/route.ts                   # GET contracts
app/api/contracts/proposals/route.ts         # GET dual-signed proposals
app/api/contracts/[id]/route.ts              # GET one contract
app/actions/contracts.ts                     # prepare / propose / record / terminate
server/modules/contracts/                    # service, repos, chain verification
server/shared/database/models/employee-contract.model.ts
server/shared/database/models/contract-proposal.model.ts
lib/blockchain/                              # MetaMask, registry client, ABI, config
lib/contracts/document.ts                    # canonical JSON + hashing
lib/contracts/eip712.ts                      # shared EIP-712 intent
components/features/contracts/               # wallet panel, form, proposals, list
components/features/web3/wallet-provider.tsx # MetaMask React context
```

## Quick start — Polygon Amoy testnet

The registry is deployed to Polygon Amoy (chain 80002), so the contract and its
full document stay readable through any Amoy RPC even when this app and MongoDB
are down. Local Hardhat remains available for contract development; see
[Local Hardhat](#local-hardhat-optional) below.

### 1. Install, compile and test

```bash
cd blockchain
npm install
npm run test        # 26 passing tests
```

### 2. Configure the deployer + HR wallet

`blockchain/.env` (copy `blockchain/.env.example`):

```dotenv
AMOY_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
# official endpoint: https://rpc-amoy.polygon.technology — either works; scripts default to this one
DEPLOYER_PRIVATE_KEY=0x...                  # dedicated deployer, funded with testnet POL
HR_ADMIN_ADDRESS=0xYourMetaMaskWallet       # the HR wallet that signs contracts
ORGANIZATION_ID=6ae3e0afc90fd0409c4e9362    # hr@moveup.tn Mongo _id
AMOY_ETHERSCAN_API_KEY=...                  # optional, only for source verification
```

`ORGANIZATION_ID` must be the `_id` of the **admin/HR user** that issues
contracts, because the app scopes every HR query to `organization = user.sub`.
Get it from Mongo:

```bash
mongosh moveup --eval 'db.users.findOne({email:"hr@moveup.tn"},{_id:1})'
```

Technically the contract stores only `ORGANIZATION_HASH = keccak256(ORGANIZATION_ID)`.
You can set `ORGANIZATION_HASH` directly if you prefer.

### 3. Deploy to Polygon Amoy

Fund the deployer address with testnet POL from
<https://faucet.polygon.technology> (Alchemy's Amoy faucet works too), then:

```bash
cd blockchain
npm run deploy:amoy
```

The script refuses to run when the RPC, deployer key, HR wallet or
organisation is missing, or when the deployer has a zero balance. On success it:
- deploys `EmploymentContractRegistry`,
- grants the HR wallet for the configured organisation,
- writes `blockchain/deployments/amoy.json` (with the deployment block),
- prints the `NEXT_PUBLIC_*` lines and the `hardhat verify` command.

### 4. Point the Next.js app at the registry

Root `.env` (or `.env.local`):

```dotenv
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_CHAIN_NAME="Polygon Amoy"
NEXT_PUBLIC_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...   # printed by npm run deploy:amoy
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://amoy.polygonscan.com

# System wallet that sends (and pays for) the on-chain contract transactions.
# It is NOT an app user; it can be the same address as the deployer. It is the
# only account that ever spends gas — HR and employees only sign for free.
CONTRACT_ADMIN_PRIVATE_KEY=0x...
```

Restart `npm run dev` after changing env values (Next.js inlines `NEXT_PUBLIC_*`
at build/dev-server start).

### 5. Configure MetaMask

1. Add **Polygon Amoy** (MetaMask → Settings → Networks → Add network): chain
   id `80002`, currency `POL`, RPC `https://polygon-amoy-bor-rpc.publicnode.com`,
   explorer `https://amoy.polygonscan.com`.
2. Connect the wallet configured as `HR_ADMIN_ADDRESS`. It only signs the
   intent (no gas), and it must be authorized on-chain for the organisation.
3. Add a second MetaMask account for the employee. It only signs the intent
   (no gas, no funds needed); put that address in the employee directory.
   Only the HR wallet needs testnet POL, because it sends the anchor
   transaction.

### 6. Use the app

1. Sign in as `hr@moveup.tn` / `Hr#2026!`.
2. Open **Contracts** → **Connect MetaMask**. The wallet panel should say
   **Authorized** for the on-chain HR role.
3. Add an employee (or edit one) and set their MetaMask wallet in the directory.
4. Issue the contract: choose employee, job title, salary, dates → click
   **Co-sign as HR**. MetaMask asks for a **signature**, not a transaction; no
   gas is spent. The proposal now appears under **Awaiting employee signature**.
5. Sign in as the employee (`alice@moveup.tn` / `Demo#2026!`), open
   **Contracts**, switch MetaMask to the employee wallet and click
   **Sign with wallet**. MetaMask asks for a **signature** only — no gas, no
   funds. The proposal now shows **SIGNED**.
6. Back as HR, click **Publish on-chain · no gas for you**. The server sends the
   transaction from the configured system wallet (`CONTRACT_ADMIN_PRIVATE_KEY`),
   which pays the gas, and stores the document + both signatures. Neither the HR
   nor the employee wallet spends anything.
7. HR sees the contract under **Organisation contracts**. Use **On-chain copy**
   to read the document JSON back from contract storage and verify its hash
   without touching MongoDB.
8. HR or the employee can terminate/resign. They sign a free `Termination` intent,
   the system wallet submits it and pays the gas, and only `keccak256(reason)`
   goes on-chain.

> Polygon Amoy is permanent: restarting the app never removes the registry or
> the stored contracts. Redeploying creates a new address, so update
> `NEXT_PUBLIC_CONTRACT_ADDRESS`; proposals prepared for the old address stay
> unusable and must be re-issued.

### Local Hardhat (optional)

For contract development without a faucet:

```bash
cd blockchain
npm run node          # terminal A
npm run deploy:local  # terminal B
```

Set the app to `NEXT_PUBLIC_CHAIN_ID=31337`,
`NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545` and the address printed by the
deploy script. A fresh node always deploys at
`0x5FbDB2315678afecb367f032d93F642f64180aa3`. Restarting `npm run node` wipes
the local chain state (registry, HR authorization, contracts) but not the
Hardhat wallets; redeploy and re-issue. Clear `employeecontracts` and
`contractproposals` for a clean local demo.

## Recover contracts without MongoDB

This is the point of storing the document on-chain. The script reads
`ContractCreated` events and then `getContract()` from the registry:

```bash
cd blockchain

# All contracts: scans ContractCreated events from the deployment block.
npm run dump:amoy

# Filter by organisation, employee wallet or contract id:
DUMP_ORG=0x<organizationHash> npm run dump:amoy
DUMP_EMPLOYEE=0x<employeeWallet> npm run dump:amoy
DUMP_ID=0x<contractId> npm run dump:amoy
DUMP_JSON=1 npm run dump:amoy > contracts.json
```

In PowerShell, set the same variables with
`$env:DUMP_ID="0x…"; npm run dump:amoy` (Hardhat rejects unknown CLI flags).
`DUMP_ID` reads the record straight from contract storage without scanning
events; the event scan is chunked (2k blocks) to stay inside hosted RPC limits.
If the deployment file was lost, set `CONTRACT_ADDRESS=0x...` and optionally
`DEPLOYMENT_BLOCK=...`.

It prints the contract id, status, both signatures, transaction hash and the
full canonical JSON. No database connection is used.

## Redeploying or granting another HR wallet

To authorize another HR wallet (or a second MetaMask account) for the same
organisation:

```dotenv
HR_ADMIN_ADDRESS=0xNewWallet
ORGANIZATION_ID=<same Mongo _id>
```

```bash
cd blockchain
npm run grant:amoy
```

`CONTRACT_ADDRESS=0x...` overrides the address from
`deployments/amoy.json` when you want to target another registry.

### Cost note

Storing a ~500-byte JSON document costs roughly 20k gas per 32-byte storage
word plus calldata, i.e. a few million gas per contract. That is acceptable on a
testnet, but can be expensive on mainnet. If cost matters:

- keep the canonical JSON small (structured terms, not a PDF),
- or store only the hash + an encrypted document blob in calldata,
- or use a cheaper L2 and keep this contract as the verifier.

## Contract reference

`EmploymentContractRegistry.sol` (Solidity 0.8.24, OpenZeppelin `Ownable` +
`Pausable` + `EIP712`).

### Roles

- **owner** — platform deployer. Authorizes/revokes HR wallets, pauses the registry.
- **HR wallet** — one or more wallets mapped to an organisation hash. Signs
  intents and can terminate contracts for that organisation.
- **employee wallet** — the wallet assigned to a contract. Signs the same intent
  (gasless) and can resign. A backend system wallet submits the anchor
  transaction and pays the gas, so no app user needs funds.

### Lifecycle

```
createContract (both signatures) → Active
terminateContract (signed)       → Terminated  (HR dismissal or employee resignation)
amendContract (both signatures)  → old = Superseded, new = Active
```

### EIP-712 intent

```solidity
struct ContractIntent {
    bytes32 organizationId;
    address employer;
    address employee;
    bytes32 employeeRefHash;
    bytes32 documentHash;
    uint64 startDate;
    uint64 endDate;              // 0 = open-ended
    bytes32 previousContractId;  // 0 for a new contract
    uint32 version;
    uint256 nonce;
    uint64 deadline;
}
```

### Write functions

```solidity
setHrAdmin(address admin, bytes32 organizationId)                 // owner
removeHrAdmin(address admin)                                      // owner
pause() / unpause()                                               // owner

createContract(ContractIntent intent, string document, string documentUri,
               bytes employerSignature, bytes employeeSignature)
               returns (bytes32 contractId)                       // either signer or relayer

amendContract(bytes32 contractId, ContractIntent intent, string document,
              string documentUri, bytes employerSignature, bytes employeeSignature)
              returns (bytes32 newContractId)                     // either signer or relayer

terminateContract(bytes32 contractId, bytes32 reasonHash,
                  uint64 deadline, bytes signature)               // HR or employee signs, any relayer sends
```

### Read functions

```solidity
getContract(bytes32 contractId) → EmploymentContract  // includes document + signatures
contractExists(bytes32 contractId) → bool
organizationContractCount(bytes32 organizationId) → uint256
isHrAdminFor(address admin, bytes32 organizationId) → bool
hrOrganization(address admin) → bytes32
hashContractIntent(ContractIntent intent) → bytes32   // EIP-712 digest
```

### Events

`HrAdminUpdated`, `ContractCreated` (includes both signatures, nonce and hash),
`ContractTerminated`, `ContractSuperseded`. The full document is in contract
storage; `ContractCreated` gives an indexer everything needed to find it.

## Privacy and legal caveats

- Names, emails, salary and dates are **public** on a public chain. This is the
  deliberate trade-off for database-independent persistence.
- The employee ref is still hashed with a private organisation id
  (`keccak256("moveup:employee:<orgId>:EMP001")`), but the document itself
  contains `EMP001`.
- A hash proves a document existed and was not modified; it is not a substitute
  for a legally valid signature in every jurisdiction. Check local employment
  law and consider a qualified e-signature provider alongside the on-chain
  anchor.
- If privacy is required, encrypt `document` before calling `createContract`
  (the hash then commits to the ciphertext) and manage the decryption key
  separately. Losing that key loses the document even though the chain keeps it.

## Production checklist

- [ ] Get the Solidity contract audited (even a small registry).
- [ ] Use a dedicated HR wallet or a multi-sig as the contract owner / HR admin.
- [ ] Keep `DEPLOYER_PRIVATE_KEY` out of the repo and CI logs; use a secret manager.
- [ ] Decide explicitly whether the full document may be public. If not, encrypt
      it or store only its hash.
- [ ] Cap document size and validate the JSON schema before signing.
- [ ] Choose the right chain for cost and finality (Polygon PoS, Base, Arbitrum,
      Ethereum mainnet). Update `NEXT_PUBLIC_*` accordingly.
- [ ] Add an indexer/worker that reconciles chain events into Mongo, including
      transactions sent outside this app. The current server records only
      transactions it verifies through its own endpoints.
- [ ] Handle wallet rotation: issue a new dual-signed contract with the new
      wallet; never silently rewrite an existing agreement.
- [ ] Add reorg handling (wait N confirmations on mainnet).
- [ ] Add rate limits, monitoring and alerting on failed `record` calls.
- [ ] Keep a legal review of the contract wording and the on-chain audit trail.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Blockchain is not configured` | Set `NEXT_PUBLIC_RPC_URL` + `NEXT_PUBLIC_CONTRACT_ADDRESS`, restart Next.js |
| `Cannot deploy to amoy. Add these…` | Fill `AMOY_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `HR_ADMIN_ADDRESS`, `ORGANIZATION_ID` in `blockchain/.env` |
| `Deployer … has no POL` | Fund the deployer from <https://faucet.polygon.technology> |
| `eth_getLogs` block range error | Use `DUMP_ID` or set `DEPLOYMENT_BLOCK`; the dump script queries 2k blocks at a time |
| `No system wallet configured` | Set `CONTRACT_ADMIN_PRIVATE_KEY` in the app `.env`, restart Next.js, then publish again |
| `NotHrAdmin` in MetaMask | Run `npm run grant:local` (or `grant:amoy`) for the connected wallet + org hash |
| Wallet panel says **Not authorized** | The connected wallet is not the one granted for this organisation |
| `Wrong network` | Use the **Switch network** button; expected chain is shown in the panel |
| `insufficient funds` | The system wallet (`CONTRACT_ADMIN_PRIVATE_KEY`) pays the anchor transaction. Fund it with testnet POL. No app user wallet needs funds |
| `SignatureExpired` | The 7-day proposal window passed; ask HR to issue a new proposal |
| `DocumentHashMismatch` | The document was modified after HR signed; issue a new proposal |
| `InvalidEmployeeSignature` / `InvalidEmployerSignature` | Switch to the wallet assigned to that side of the contract |
| `Transaction not confirmed yet` | Wait a few seconds and retry; the server only records mined transactions |
| Local contract disappears after restart | Hardhat resets state; run `npm run deploy:local` again (Polygon Amoy contracts persist) |
| `This contract preparation expired` | The 1-hour signed preparation token expired; submit the form again |
| Employee cannot sign | The connected wallet must exactly match the wallet assigned to the proposal |
| Old Mongo rows show blank signatures | They were created by the previous one-sided flow; re-issue them with the dual-sign flow |

# Data Flow Diagrams

> AetherMint — Key Operational Flows

---

## 1. Credential Issuance Flow

```
Student                  Frontend             Backend API           Stellar Network       PostgreSQL
   │                         │                     │                       │                  │
   │  Complete course        │                     │                       │                  │
   ├────────────────────────►│                     │                       │                  │
   │                         │  POST /api/         │                       │                  │
   │                         │  credentials/issue  │                       │                  │
   │                         ├────────────────────►│                       │                  │
   │                         │                     │  Validate enrollment  │                  │
   │                         │                     ├──────────────────────────────────────────►
   │                         │                     │◄─────────────────────────────────────────┤
   │                         │                     │  Build Soroban TX     │                  │
   │                         │                     │  (credential_registry │                  │
   │                         │                     │   .issue_credential)  │                  │
   │                         │                     ├──────────────────────►│                  │
   │                         │                     │                       │  Execute WASM    │
   │                         │                     │                       │  contract        │
   │                         │                     │◄──────────────────────┤                  │
   │                         │                     │  TX hash + credential │                  │
   │                         │                     │  ID returned          │                  │
   │                         │                     │  Store credential     │                  │
   │                         │                     │  metadata in DB       │                  │
   │                         │                     ├──────────────────────────────────────────►
   │                         │                     │  Upload credential    │                  │
   │                         │                     │  JSON to IPFS         │                  │
   │                         │ 200 + credential ID │                       │                  │
   │                         │◄────────────────────┤                       │                  │
   │  Render NFT badge       │                     │                       │                  │
   │◄────────────────────────┤                     │                       │                  │
```

---

## 2. Course Enrollment Flow

```
Student                  Frontend             Backend API           PostgreSQL          Stellar
   │                         │                     │                     │                 │
   │  Click Enroll           │                     │                     │                 │
   ├────────────────────────►│                     │                     │                 │
   │                         │  POST /api/courses/ │                     │                 │
   │                         │  :id/enroll         │                     │                 │
   │                         ├────────────────────►│                     │                 │
   │                         │                     │  Validate JWT       │                 │
   │                         │                     │  Check capacity     │                 │
   │                         │                     ├────────────────────►│                 │
   │                         │                     │◄────────────────────┤                 │
   │                         │                     │  Paid course?       │                 │
   │                         │  Payment required?  │                     │                 │
   │◄────────────────────────┤◄────────────────────┤                     │                 │
   │  Wallet prompt          │                     │                     │                 │
   ├────────────────────────►│                     │                     │                 │
   │  Sign XLM TX            │  Submit signed TX   │                     │                 │
   │                         ├────────────────────►│                     │                 │
   │                         │                     │  Submit to Stellar  │                 │
   │                         │                     ├────────────────────────────────────►  │
   │                         │                     │◄────────────────────────────────────┤  │
   │                         │                     │  Confirmed          │                 │
   │                         │                     │  Create Enrollment  │                 │
   │                         │                     ├────────────────────►│                 │
   │                         │  201 Enrolled       │◄────────────────────┤                 │
   │  Access course content  │◄────────────────────┤                     │                 │
   │◄────────────────────────┤                     │                     │                 │
```

---

## 3. IPFS Content Upload Flow

```
Educator                 Frontend             Backend API           IPFS Node         PostgreSQL
   │                         │                     │                     │                 │
   │  Upload course file     │                     │                     │                 │
   ├────────────────────────►│                     │                     │                 │
   │                         │  POST /api/content/ │                     │                 │
   │                         │  upload (multipart) │                     │                 │
   │                         ├────────────────────►│                     │                 │
   │                         │                     │  Authenticate +     │                 │
   │                         │                     │  validate MIME type │                 │
   │                         │                     │  Scan for malware   │                 │
   │                         │                     │  (ipfsAuth.js)      │                 │
   │                         │                     │                     │                 │
   │                         │                     │  ipfsService        │                 │
   │                         │                     │  .uploadFile()      │                 │
   │                         │  Progress (WS)      ├────────────────────►│                 │
   │◄────────────────────────┤◄────────────────────┤  Chunked upload     │                 │
   │                         │                     │◄────────────────────┤                 │
   │                         │                     │  CID returned       │                 │
   │                         │                     │  Pin content        │                 │
   │                         │                     ├────────────────────►│                 │
   │                         │                     │  Store metadata     │                 │
   │                         │                     │  (CID, size, type)  │                 │
   │                         │                     ├────────────────────────────────────►  │
   │                         │  200 { cid, url }   │◄────────────────────────────────────┤  │
   │  File accessible via    │◄────────────────────┤                     │                 │
   │  IPFS CID               │                     │                     │                 │
   │◄────────────────────────┤                     │                     │                 │
```

---

## 4. User Authentication Flow

```
User                     Frontend             Backend API           Redis             PostgreSQL
   │                         │                     │                   │                  │
   │  Connect wallet /       │                     │                   │                  │
   │  Enter credentials      │                     │                   │                  │
   ├────────────────────────►│                     │                   │                  │
   │                         │  POST /api/auth/    │                   │                  │
   │                         │  login              │                   │                  │
   │                         ├────────────────────►│                   │                  │
   │                         │                     │  Validate input   │                  │
   │                         │                     │  (sanitizer.ts)   │                  │
   │                         │                     │  Lookup user      │                  │
   │                         │                     ├──────────────────────────────────────►
   │                         │                     │◄─────────────────────────────────────┤
   │                         │                     │  bcrypt compare   │                  │
   │                         │                     │  Issue JWT        │                  │
   │                         │                     │  Store session    │                  │
   │                         │                     ├──────────────────►│                  │
   │                         │  200 { token,       │◄──────────────────┤                  │
   │                         │    refreshToken }   │                   │                  │
   │  Store token in         │◄────────────────────┤                   │                  │
   │  memory / cookie        │                     │                   │                  │
   │◄────────────────────────┤                     │                   │                  │
   │                         │                     │                   │                  │
   │  Subsequent requests    │  Bearer <JWT>       │                   │                  │
   ├────────────────────────►├────────────────────►│  auth.ts verifies │                  │
   │                         │                     │  JWT signature    │                  │
   │                         │                     │  rbac.ts checks   │                  │
   │                         │                     │  permissions      │                  │
```

---

## 5. Federated Learning Flow

```
Backend API          FL Coordinator       Participant Nodes       Privacy Layer       Model Store
   │                      │                       │                     │                 │
   │  Trigger FL round    │                       │                     │                 │
   ├─────────────────────►│                       │                     │                 │
   │                      │  Broadcast model      │                     │                 │
   │                      │  fragment to nodes    │                     │                 │
   │                      ├──────────────────────►│                     │                 │
   │                      │                       │  Train on local     │                 │
   │                      │                       │  data (on-device)   │                 │
   │                      │                       │  Compute gradient   │                 │
   │                      │                       │  Apply DP noise     │                 │
   │                      │                       ├────────────────────►│                 │
   │                      │                       │◄────────────────────┤                 │
   │                      │  Encrypted gradient   │                     │                 │
   │                      │◄──────────────────────┤                     │                 │
   │                      │  Secure aggregation   │                     │                 │
   │                      │  (secureMultiParty    │                     │                 │
   │                      │   Computation.js)     │                     │                 │
   │                      │  Update global model  │                     │                 │
   │                      ├──────────────────────────────────────────────────────────────►│
   │  Model updated       │◄─────────────────────────────────────────────────────────────┤│
   │◄─────────────────────┤                       │                     │                 │
```

---

## 6. Real-Time Collaboration Flow

```
User A                   Frontend             Backend WS            User B             Redis
(teacher)                (Socket.IO)          (websocketService)    (student)          (pub/sub)
   │                         │                     │                     │                 │
   │  Join session           │                     │                     │                 │
   ├────────────────────────►│  WS connect         │                     │                 │
   │                         ├────────────────────►│                     │                 │
   │                         │                     │  Create/join room   │                 │
   │                         │                     ├────────────────────────────────────►  │
   │  Draw on whiteboard     │                     │                     │                 │
   ├────────────────────────►│  emit: draw_stroke  │                     │                 │
   │                         ├────────────────────►│                     │                 │
   │                         │                     │  Broadcast to room  │                 │
   │                         │                     ├────────────────────────────────────►  │
   │                         │                     │  Publish to Redis   │                 │
   │                         │                     ├──────────────────────────────────────►│
   │                         │                     │                     │  Subscribe event│
   │                         │                     │◄────────────────────────────────────┤  │
   │                         │  on: draw_stroke    │                     │                 │
   │                         │◄────────────────────┤                     │                 │
   │                         │  Render stroke      │                     │                 │
   │◄────────────────────────┤  (for User B)       │                     │                 │
   │                         │                     │                     │                 │
   │                         │                     │  Persist session    │                 │
   │                         │                     │  (whiteboardSession │                 │
   │                         │                     │   Store.ts)         │                 │
```

---

## 7. Credential Verification Flow (External Verifier)

```
Verifier                 Stellar Explorer     Backend API           Stellar Network    IPFS
   │                     (or direct API)          │                       │              │
   │  Request credential  │                       │                       │              │
   │  verification        │                       │                       │              │
   ├─────────────────────►│  GET /api/            │                       │              │
   │                      │  credentials/:id      │                       │              │
   │                      ├──────────────────────►│                       │              │
   │                      │                       │  Query credential_    │              │
   │                      │                       │  registry contract    │              │
   │                      │                       ├──────────────────────►│              │
   │                      │                       │  Read ledger state    │              │
   │                      │                       │◄──────────────────────┤              │
   │                      │                       │  Fetch metadata       │              │
   │                      │                       │  from IPFS via CID    │              │
   │                      │                       ├────────────────────────────────────► │
   │                      │                       │◄──────────────────────────────────── │
   │                      │  200 {                │                       │              │
   │                      │    valid: true,       │                       │              │
   │                      │    issuer,            │                       │              │
   │                      │    timestamp,         │                       │              │
   │                      │    txHash             │                       │              │
   │◄─────────────────────┤  }                    │                       │              │
```

---

*All diagrams reflect the actual code structure in the repository. For implementation details, see the ADRs in [`docs/adr/`](../adr/README.md).*

# C4 Level 3: Component Diagrams

> AetherMint — Internal Components of Major Services

---

## 1. Backend API Components (`backend/src/`)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                         backend/  (Express.js / Node.js)                           │
│                                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                         MIDDLEWARE STACK                                    │  │
│  │                                                                             │  │
│  │  requestId ─► requestLogger ─► helmet ─► cors ─► tieredRateLimiter        │  │
│  │  ─► ddosProtection ─► botDetection ─► requestSanitizer ─► auth ─► rbac   │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                            │
│                          ┌────────────▼────────────┐                              │
│                          │      ROUTE LAYER         │                              │
│                          │  (backend/src/routes/)   │                              │
│                          │                          │                              │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │  /auth    │ │/courses  │ │/credentials│ │ /content │ │/analytics│ │/quantum│  │
│  │  /users   │ │/enroll   │ │/profiles   │ │ /ipfs    │ │/federated│ │/crypto │  │
│  │  /admin   │ │/quizzes  │ │/timeLock   │ │/holograph│ │/swarm    │ │        │  │
│  │  /rbac    │ │/assign.  │ │/vrf        │ │/sync     │ │/predict  │ │        │  │
│  └─────┬─────┘ └────┬─────┘ └─────┬──────┘ └────┬─────┘ └────┬─────┘ └───┬────┘  │
│        │            │             │              │            │           │       │
│        └────────────┴─────────────┴──────────────┴────────────┴───────────┘       │
│                                       │                                            │
│                          ┌────────────▼────────────┐                              │
│                          │    CONTROLLER LAYER      │                              │
│                          │  (backend/src/           │                              │
│                          │   controllers/)          │                              │
│                          └────────────┬────────────┘                              │
│                                       │                                            │
│  ┌────────────────────────────────────▼──────────────────────────────────────┐    │
│  │                          SERVICE LAYER                                     │    │
│  │                       (backend/src/services/)                              │    │
│  │                                                                            │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │    │
│  │  │  STELLAR GROUP   │  │   DATA GROUP     │  │     ML / AI GROUP        │ │    │
│  │  │                  │  │                  │  │                          │ │    │
│  │  │• stellarService  │  │• contentService  │  │• federatedLearning       │ │    │
│  │  │• StellarPayment  │  │• enrollmentSvc   │  │  Coordinator             │ │    │
│  │  │• transactionQ    │  │• courseService   │  │• recommendationEngine    │ │    │
│  │  │• vrfService      │  │• userService     │  │• predictionEngine (ML/)  │ │    │
│  │  │• timeLockCred    │  │• gradingService  │  │• swarmLearning           │ │    │
│  │  │• marketplaceSvc  │  │• assignmentSvc   │  │• differentialPrivacy     │ │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────────────┘ │    │
│  │                                                                            │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │    │
│  │  │  SECURITY GROUP  │  │  STORAGE GROUP   │  │   ANALYTICS GROUP        │ │    │
│  │  │                  │  │                  │  │                          │ │    │
│  │  │• quantumResistant│  │• ipfsService     │  │• analyticsService        │ │    │
│  │  │  Crypto          │  │• holographic     │  │• instructorAnalytics     │ │    │
│  │  │• quantumKey      │  │  Storage         │  │• studentAnalytics        │ │    │
│  │  │  Management      │  │• fileUploadSvc   │  │• platformAnalytics       │ │    │
│  │  │• hybridEncryption│  │• mediaService    │  │• reportingService        │ │    │
│  │  │• secureRealtime  │  │• redisCluster    │  │• tenantAnalytics         │ │    │
│  │  │  Communication   │  │                  │  │• dataVisualization       │ │    │
│  │  │• fraudDetection  │  │                  │  │                          │ │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────────────┘ │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
│                                       │                                            │
│  ┌────────────────────────────────────▼──────────────────────────────────────┐    │
│  │                    DATA ACCESS LAYER                                       │    │
│  │                                                                            │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────────────┐ │    │
│  │  │  Prisma ORM    │  │  ioredis       │  │   Stellar SDK (Horizon)      │ │    │
│  │  │  (PostgreSQL)  │  │  (Redis)       │  │   + IPFS HTTP client         │ │    │
│  │  └────────────────┘  └────────────────┘  └──────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Smart Contract Components (`contracts/src/`)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                     contracts/  (Rust / Soroban SDK 26.1.0)                        │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │                     CREDENTIAL DOMAIN                                     │    │
│  │                                                                           │    │
│  │  ┌──────────────────────┐   ┌───────────────────────┐                    │    │
│  │  │  credential_registry │   │  credentials.rs        │                    │    │
│  │  │                      │   │                        │                    │    │
│  │  │  • issue_credential  │   │  • issue / verify      │                    │    │
│  │  │  • verify_credential │   │  • revoke              │                    │    │
│  │  │  • revoke_credential │   │  • transfer ownership  │                    │    │
│  │  │  • batch_operations  │   └───────────────────────┘                    │    │
│  │  └──────────────────────┘                                                │    │
│  │                                                                           │    │
│  │  ┌──────────────────────┐   ┌───────────────────────┐                    │    │
│  │  │  time_lock_cred.rs   │   │  credential_events.rs  │                    │    │
│  │  │                      │   │                        │                    │    │
│  │  │  • lock / unlock on  │   │  • emit structured     │                    │    │
│  │  │    time condition    │   │    on-chain events     │                    │    │
│  │  └──────────────────────┘   └───────────────────────┘                    │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │                      COURSE DOMAIN                                        │    │
│  │                                                                           │    │
│  │  ┌──────────────────────┐   ┌───────────────────────┐                    │    │
│  │  │  courseMetadata.rs   │   │  dynamic_nft.rs        │                    │    │
│  │  │                      │   │                        │                    │    │
│  │  │  • create_course     │   │  • mint NFT badge      │                    │    │
│  │  │  • update metadata   │   │  • evolve NFT state    │                    │    │
│  │  │  • enroll_student    │   │  • transfer NFT        │                    │    │
│  │  │  • storage optimized │   └───────────────────────┘                    │    │
│  │  │    (30% reduction)   │                                                │    │
│  │  └──────────────────────┘                                                │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │                   IDENTITY / PROFILE DOMAIN                               │    │
│  │                                                                           │    │
│  │  ┌──────────────────────┐   ┌───────────────────────┐                    │    │
│  │  │  user_profile.rs     │   │  governance.rs         │                    │    │
│  │  │                      │   │                        │                    │    │
│  │  │  • create / update   │   │  • proposals           │                    │    │
│  │  │  • privacy levels    │   │  • voting              │                    │    │
│  │  │  • packed storage    │   │  • execution           │                    │    │
│  │  └──────────────────────┘   └───────────────────────┘                    │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │                  ADVANCED / EXPERIMENTAL DOMAIN                           │    │
│  │                                                                           │    │
│  │  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │    │
│  │  │ vrf_system   │  │ proctoring  │  │ dna_storage  │  │ analyticsStr. │ │    │
│  │  │              │  │             │  │              │  │               │ │    │
│  │  │ Verifiable   │  │ Anti-cheat  │  │ DNA-encoded  │  │ On-chain      │ │    │
│  │  │ Random Fn    │  │ monitoring  │  │ data storage │  │ analytics     │ │    │
│  │  └──────────────┘  └─────────────┘  └──────────────┘  └───────────────┘ │    │
│  │                                                                           │    │
│  │  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐                    │    │
│  │  │ consciousness│  │ syncCoordin │  │ marketplace  │                    │    │
│  │  │ .rs          │  │ ation.rs    │  │ .rs          │                    │    │
│  │  │              │  │             │  │              │                    │    │
│  │  │ Consciousness│  │ Multi-device│  │ Course &     │                    │    │
│  │  │ state model  │  │ sync coord. │  │ credential   │                    │    │
│  │  └──────────────┘  └─────────────┘  │ marketplace  │                    │    │
│  │                                      └──────────────┘                    │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │                     SHARED UTILITIES                                      │    │
│  │                                                                           │    │
│  │  ┌─────────────────────────┐   ┌──────────────────────────┐              │    │
│  │  │  utils/storage.rs       │   │  utils/validation.rs      │              │    │
│  │  │  • PackedTimestamps      │   │  • input guards           │              │    │
│  │  │  • PackedUserFlags       │   │  • address checks         │              │    │
│  │  │  • StorageTier enum      │   └──────────────────────────┘              │    │
│  │  │  • HashStorage           │                                             │    │
│  │  └─────────────────────────┘   ┌──────────────────────────┐              │    │
│  │                                │  utils/pause.rs           │              │    │
│  │                                │  • emergency pause guard  │              │    │
│  │                                └──────────────────────────┘              │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend Components (`frontend/src/`)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                     frontend/  (Next.js 14 / TypeScript / TailwindCSS)             │
│                                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────┐     │
│  │                         APP ROUTER (src/app/)                            │     │
│  │                                                                          │     │
│  │  /              /courses    /profile    /collaboration   /admin          │     │
│  │  /credentials   /enroll     /settings   /lab            /campus          │     │
│  └─────────────────────────────────┬────────────────────────────────────────┘     │
│                                    │                                              │
│  ┌─────────────────────────────────▼────────────────────────────────────────┐     │
│  │                       COMPONENT LAYER (src/components/)                  │     │
│  │                                                                          │     │
│  │  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────────────┐  │     │
│  │  │   CORE UI       │  │  WEB3 / WALLET │  │   LEARNING MODULES       │  │     │
│  │  │                 │  │                │  │                          │  │     │
│  │  │ • ui/ (shadcn)  │  │ • WalletConn.  │  │ • ContentUploader        │  │     │
│  │  │ • Skeleton      │  │   ector.tsx    │  │ • AssessmentInterface    │  │     │
│  │  │ • ErrorBoundary │  │ • Wallet/      │  │ • GradingInterface       │  │     │
│  │  │ • LoadingFallb. │  │ • CredList.tsx │  │ • AssignmentSubmission   │  │     │
│  │  └─────────────────┘  │ • CredMarket.  │  │ • EnrollmentForm         │  │     │
│  │                       │ • StakingDash. │  │ • Quiz/                  │  │     │
│  │                       └────────────────┘  └──────────────────────────┘  │     │
│  │                                                                          │     │
│  │  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────────────┐  │     │
│  │  │  COLLABORATION  │  │    ANALYTICS   │  │   ADVANCED FEATURES      │  │     │
│  │  │                 │  │                │  │                          │  │     │
│  │  │ • Collaboration │  │ • Analytics/   │  │ • NeuralInterface/       │  │     │
│  │  │   Room          │  │ • ProfileStats │  │ • BCI/                   │  │     │
│  │  │ • Collaborative │  │ • AchievDisp.  │  │ • MixedReality/          │  │     │
│  │  │   Editor        │  │ • dashboard/   │  │ • Metaverse/             │  │     │
│  │  │ • collaboration/│  │                │  │ • QuantumTeleportation/  │  │     │
│  │  │   (whiteboard,  │  │                │  │ • ARVR/                  │  │     │
│  │  │    chat, etc.)  │  │                │  │ • Lab/                   │  │     │
│  │  └─────────────────┘  └────────────────┘  └──────────────────────────┘  │     │
│  └─────────────────────────────────┬────────────────────────────────────────┘     │
│                                    │                                              │
│  ┌─────────────────────────────────▼────────────────────────────────────────┐     │
│  │              LIBRARY / SERVICES LAYER (src/lib/ + src/services/)         │     │
│  │                                                                          │     │
│  │  ┌──────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐ │     │
│  │  │  stellar.ts  │  │  ipfs.ts    │  │  i18n.ts    │  │  perf-monitor │ │     │
│  │  │  (Stellar    │  │  (IPFS      │  │  (next-     │  │  .ts          │ │     │
│  │  │   SDK wrap.) │  │   client)   │  │  i18next)   │  │               │ │     │
│  │  └──────────────┘  └─────────────┘  └─────────────┘  └───────────────┘ │     │
│  │                                                                          │     │
│  │  ┌──────────────┐  ┌─────────────┐  ┌─────────────┐                    │     │
│  │  │  stellar/    │  │  biometrics/│  │  bci/       │                    │     │
│  │  │  (wallet,    │  │  (biometric │  │  (brain-    │                    │     │
│  │  │   contract   │  │   auth)     │  │  computer   │                    │     │
│  │  │   client)    │  │             │  │  interface) │                    │     │
│  │  └──────────────┘  └─────────────┘  └─────────────┘                    │     │
│  └──────────────────────────────────────────────────────────────────────────┘     │
│                                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                        STATE / CONTEXT LAYER                                │  │
│  │                                                                             │  │
│  │  AuthContext  •  WalletContext  •  courseStore (Zustand)  •  chatStore      │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Machine Learning Components (`backend/src/ml/` + `backend/src/quantum/`)

```
┌────────────────────────────────────────────────────────────┐
│                    ML / AI LAYER (Python + JS)              │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │             Python ML Modules (src/ml/)             │   │
│  │                                                    │   │
│  │  • content_based_filtering.py  — course recommend. │   │
│  │  • collaborative_filtering.py  — user similarity   │   │
│  │  • nlp_processor.py            — text analysis     │   │
│  │  • ranking_algorithm.py        — search ranking    │   │
│  │  • semantic_search.py          — semantic vectors  │   │
│  │  • recommendation_service.py   — unified recs API  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │          JavaScript ML Modules (src/ml/)            │   │
│  │                                                    │   │
│  │  • predictionEngine.js         — outcome predict.  │   │
│  │  • learningPathOptimizer.js    — adaptive paths    │   │
│  │  • atRiskIdentification.js     — at-risk students  │   │
│  │  • interventionEngine.js       — proactive actions │   │
│  │  • modelAccuracyTracker.js     — model monitoring  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │         Quantum Computing Layer (src/quantum/)      │   │
│  │                                                    │   │
│  │  • quantum_circuits.py         — circuit simulator │   │
│  │  • quantum_algorithms.py       — Grover, QFT, etc. │   │
│  │  • quantum_ml.py               — QML models        │   │
│  │  • quantum_optimizer.py        — variational QA    │   │
│  │  • quantum_error_correction.py — error mitigation  │   │
│  │  • hybrid_computing.py         — classical+quantum │   │
│  └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

---

*See [data-flow-diagrams.md](./data-flow-diagrams.md) for end-to-end operational flows.*

# ADR-004: Federated Learning Architecture for AI/ML Features

**Status**: Accepted

**Date**: 2024-09

**Deciders**: Core development team

## Context

AetherMint offers AI-powered features for personalized learning: adaptive content recommendations, skill gap analysis, learning style detection, emotion recognition, and cognitive load monitoring. These features require machine learning models that process user data.

A traditional centralized ML approach would:
- Require collecting all user learning data on central servers
- Create privacy concerns with sensitive educational data
- Face regulatory hurdles (GDPR, FERPA, COPPA)
- Introduce latency for real-time features

Federated learning addresses these concerns by training models locally on user devices and sharing only model updates (gradients), not raw data.

## Decision

We will implement a **federated learning architecture** with the following components:

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Client-side ML** | TensorFlow.js (`@tensorflow/tfjs` v4), brain.js | Local model training in the browser |
| **Server coordination** | Node.js with `ml-kmeans`, `ml-matrix` | Model aggregation, clustering, analysis |
| **NLP/Text processing** | `natural`, `node-nlp`, `compromise` | Learning content analysis, skill extraction |
| **Differential privacy** | Custom DP implementation in `DifferentialPrivacy.test.js` | Privacy-preserving gradient sharing |
| **Secure aggregation** | Custom secure aggregation in `SecureAggregation.test.js` | Aggregating model updates without revealing individual contributions |

Specifically:
- Models train on user devices using TensorFlow.js in the browser
- Only encrypted model updates (gradients) are sent to the coordination server
- The `FederatedLearningCoordinator` aggregates updates using secure aggregation protocols
- Differential privacy noise is applied before gradient sharing to prevent membership inference attacks
- The coordination server never sees raw user learning data

## Alternatives Considered

### Centralized ML Server
- **Pros**: Simpler architecture, easier to debug, faster model iteration, larger training datasets
- **Cons**: Privacy risk, regulatory compliance burden, latency for real-time features, data sovereignty issues
- **Why rejected**: The privacy requirements of educational data (especially for minors) make centralized data collection legally and ethically untenable. GDPR and FERPA compliance would be significantly more complex.

### Third-party ML APIs (OpenAI, Google Cloud AI)
- **Pros**: No model training infrastructure needed, state-of-the-art models, fast time-to-market
- **Cons**: Data leaves user's device, API costs scale with usage, vendor lock-in, privacy concerns
- **Why rejected**: Sending student learning data to third-party APIs creates unacceptable privacy and compliance risks. API costs would make the free tier unsustainable.

### On-device only (no coordination)
- **Pros**: Maximum privacy, no server infrastructure
- **Cons**: Models learn only from individual user data, no benefit from collective learning, slower improvement
- **Why rejected**: Federated learning provides the best of both worlds — privacy-preserving collective intelligence. Pure on-device ML would miss the network effects of shared learning.

## Consequences

### Positive
- **Privacy-preserving**: Raw user data never leaves the device
- **Regulatory compliance**: GDPR/FERPA-friendly architecture
- **Low latency**: Real-time ML inference in the browser (no server round-trip)
- **Personalized**: Models adapt to individual learning patterns
- **Network effects**: All users benefit from collective learning improvements

### Negative
- **Coordination complexity**: Secure aggregation, differential privacy, and model versioning add significant engineering complexity
- **Debugging difficulty**: Cannot inspect raw training data; debugging model issues requires indirect methods
- **Client resource usage**: TensorFlow.js in the browser consumes memory and CPU; may impact performance on low-end devices
- **Model staleness**: Federated models converge slower than centralized training
- **Heterogeneous clients**: Different devices have different compute capabilities and data distributions

### Neutral
- **Test infrastructure**: Requires integration tests with mock federation rounds (`backend/tests/integration/federatedLearning.integration.test.js`)
- **Versioning**: Models must be versioned and compatible across client/server updates
- **Monitoring**: Need metrics on federation round participation, model quality, and client dropout rates

## References

- [TensorFlow.js Documentation](https://www.tensorflow.org/js)
- [Federated Learning: Collaborative Machine Learning without Centralized Training Data](https://ai.googleblog.com/2017/04/federated-learning-collaborative.html)
- `backend/src/tests/federatedLearning/` — Federated learning test suite
- `frontend/src/services/neuralData.ts` — Client-side neural data processing

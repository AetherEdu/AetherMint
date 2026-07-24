/**
 * OpenAPI 3.0 Specification Builder
 * Dynamically assembles the full API spec from inline component schemas
 * plus JSDoc @openapi annotations in route files.
 *
 * Serves as the single source of truth for swagger-jsdoc configuration.
 *
 * Issue #254 — the shared error schema is now RFC 7807 Problem Details.
 */

import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

// ─── Inline component schemas ────────────────────────────────────────────────

const components = {
  securitySchemes: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'JWT access token obtained from POST /api/auth/login or POST /api/auth/register',
    },
    ApiKeyAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
      description: 'Static API key for server-to-server integrations',
    },
  },

  schemas: {
    // ── Legacy error schemas (kept for backward-compat) ─────────────────
    //
    // Some route JSDoc annotations still reference `Error` and
    // `ErrorResponse`.  These are thin wrappers around the canonical
    // ProblemDetails schema so swagger-parser validation passes.
    Error: {
      type: 'object',
      description: 'Legacy error object — superseded by ProblemDetails.',
      properties: {
        code: { type: 'string', example: 'INTERNAL_ERROR' },
        message: { type: 'string', example: 'An unexpected error occurred' },
        details: { type: 'object', nullable: true },
        requestId: { type: 'string', example: '7e2c1f5a-8d2b-4e0d-9d6f-3a1d2e9b4c10' },
      },
    },
    ErrorResponse: {
      type: 'object',
      description: 'Legacy error response — superseded by ProblemDetails.',
      required: ['success', 'error'],
      properties: {
        success: { type: 'boolean', enum: [false] },
        error: { $ref: '#/components/schemas/Error' },
      },
    },

    // ── Shared error shape (RFC 7807) ─────────────────────────────────────
    //
    // Every non-2xx API response is `application/problem+json` with the
    // shape defined by IETF RFC 7807.  See the catalog at
    // `backend/docs/ERROR_CATALOG.md` for the canonical list of codes,
    // statuses, and type URIs.
    ProblemDetails: {
      type: 'object',
      description:
        'RFC 7807 Problem Details object returned by every AetherMint API endpoint on error. ' +
        'The Content-Type is `application/problem+json`.',
      required: ['type', 'title', 'status', 'detail', 'instance', 'code', 'success', 'requestId', 'timestamp'],
      properties: {
        type: {
          type: 'string',
          format: 'uri',
          description:
            'Stable URI identifying the problem class. Each code maps to exactly one type — see the Error Catalog.',
          example: 'https://aethermint.io/problems/validation-error',
        },
        title: {
          type: 'string',
          description:
            'Short, human-readable summary of the *kind* of problem. Stable across occurrences.',
          example: 'Validation Error',
        },
        status: {
          type: 'integer',
          description: 'HTTP status code. Always matches the response status.',
          example: 400,
        },
        detail: {
          type: 'string',
          description: 'Human-readable explanation specific to this occurrence.',
          example: '"email" must be a valid email',
        },
        instance: {
          type: 'string',
          description: 'URI reference identifying the specific occurrence (method + path).',
          example: 'POST /api/auth/register',
        },
        code: {
          type: 'string',
          description: 'Machine-readable AetherMint error code (catalogued in ERROR_CATALOG.md).',
          example: 'VALIDATION_ERROR',
        },
        success: {
          type: 'boolean',
          enum: [false],
          description: 'Always `false` for an error response. Preserved for existing clients.',
        },
        requestId: {
          type: 'string',
          format: 'uuid',
          description: 'Correlation id; matches the `X-Request-ID` response header.',
          example: '7e2c1f5a-8d2b-4e0d-9d6f-3a1d2e9b4c10',
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'ISO-8601 timestamp captured when the response was composed.',
        },
        errors: {
          type: 'array',
          description: 'Field-level validation errors (RFC 7807 §A extension).',
          items: { $ref: '#/components/schemas/FieldValidationError' },
        },
        // Deprecated legacy mirror — kept so existing consumers continue to work.
        error: {
          type: 'object',
          deprecated: true,
          description: 'Legacy `{success:false, error:{…}}` mirror retained for backward compatibility.',
          properties: {
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string', example: 'Validation failed' },
            details: { type: 'object', nullable: true },
            requestId: { type: 'string', example: '7e2c1f5a-8d2b-4e0d-9d6f-3a1d2e9b4c10' },
            stack: { type: 'string', description: 'Only present in `development`.' },
          },
        },
      },
    },

    FieldValidationError: {
      type: 'object',
      description: 'A single field-level validation failure.',
      required: ['field', 'message'],
      properties: {
        field: { type: 'string', example: 'email' },
        message: { type: 'string', example: '"email" must be a valid email' },
        rule: { type: 'string', description: 'Optional Joi/express-validator rule name.', example: 'string.email' },
      },
    },

    // ── Pagination ──────────────────────────────────────────────────────────
    Pagination: {
      type: 'object',
      properties: {
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 10 },
        total: { type: 'integer', example: 100 },
        pages: { type: 'integer', example: 10 },
      },
    },

    // ── User ────────────────────────────────────────────────────────────────
    User: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'usr_01HXZ9QABC123456' },
        username: { type: 'string', example: 'johndoe' },
        email: {
          type: 'string',
          format: 'email',
          example: 'john@example.com',
        },
        role: {
          type: 'string',
          enum: ['student', 'educator', 'admin'],
          example: 'student',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-15T10:30:00.000Z',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-06-01T08:00:00.000Z',
        },
      },
    },

    AuthResponse: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Login successful' },
        user: { $ref: '#/components/schemas/User' },
        token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },

    RegisterRequest: {
      type: 'object',
      required: ['username', 'email', 'password'],
      properties: {
        username: { type: 'string', example: 'johndoe' },
        email: {
          type: 'string',
          format: 'email',
          example: 'john@example.com',
        },
        password: {
          type: 'string',
          format: 'password',
          minLength: 8,
          example: 'securePass123',
        },
        role: {
          type: 'string',
          enum: ['student', 'educator', 'admin'],
          default: 'student',
        },
      },
    },

    LoginRequest: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', example: 'johndoe' },
        password: {
          type: 'string',
          format: 'password',
          example: 'securePass123',
        },
      },
    },

    // ── Course ──────────────────────────────────────────────────────────────
    Course: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'course_01HXZ9QABC123456' },
        title: { type: 'string', example: 'Introduction to Blockchain' },
        description: {
          type: 'string',
          example: 'A beginner-friendly course on blockchain fundamentals.',
        },
        category: { type: 'string', example: 'programming' },
        level: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced'],
          example: 'beginner',
        },
        price: { type: 'number', format: 'float', example: 49.99 },
        currency: { type: 'string', example: 'USD' },
        instructorId: {
          type: 'string',
          example: 'usr_01HXZ9QABC789012',
        },
        rating: { type: 'number', format: 'float', example: 4.7 },
        enrollmentCount: { type: 'integer', example: 1250 },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-10T09:00:00.000Z',
        },
      },
    },

    CourseSearchRequest: {
      type: 'object',
      required: ['query', 'sessionId'],
      properties: {
        query: { type: 'string', example: 'blockchain fundamentals' },
        sessionId: { type: 'string', example: 'sess_abc123' },
        filters: {
          type: 'object',
          properties: {
            category: { type: 'string', example: 'programming' },
            level: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'advanced'],
            },
            priceRange: {
              type: 'object',
              properties: {
                min: { type: 'number', example: 0 },
                max: { type: 'number', example: 100 },
              },
            },
            rating: {
              type: 'number',
              format: 'float',
              minimum: 0,
              maximum: 5,
              example: 4.0,
            },
            sortBy: {
              type: 'string',
              enum: [
                'relevance',
                'rating',
                'price-low',
                'price-high',
                'newest',
                'popular',
              ],
              example: 'rating',
            },
            page: { type: 'integer', minimum: 1, example: 1 },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              example: 10,
            },
          },
        },
      },
    },

    // ── Enrollment ──────────────────────────────────────────────────────────
    Enrollment: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'enr_01HXZ9QABC999001' },
        userId: { type: 'string', example: 'usr_01HXZ9QABC123456' },
        courseId: { type: 'string', example: 'course_01HXZ9QABC123456' },
        status: {
          type: 'string',
          enum: ['pending', 'active', 'completed', 'cancelled'],
          example: 'active',
        },
        paymentStatus: {
          type: 'string',
          enum: ['pending', 'completed', 'failed', 'refunded'],
          example: 'completed',
        },
        progress: {
          type: 'number',
          format: 'float',
          minimum: 0,
          maximum: 100,
          example: 65.5,
        },
        enrolledAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-02-01T12:00:00.000Z',
        },
        completedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          example: null,
        },
      },
    },

    CreateEnrollmentRequest: {
      type: 'object',
      required: ['courseId', 'paymentMethod'],
      properties: {
        courseId: { type: 'string', example: 'course_01HXZ9QABC123456' },
        paymentMethod: {
          type: 'string',
          enum: ['stellar', 'stripe', 'paypal', 'free'],
          example: 'stellar',
        },
        paymentDetails: {
          type: 'object',
          properties: {
            amount: { type: 'number', example: 49.99 },
            currency: { type: 'string', example: 'USD' },
            fromAddress: {
              type: 'string',
              example:
                'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA',
            },
          },
        },
      },
    },

    // ── Payment ─────────────────────────────────────────────────────────────
    Payment: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'pay_01HXZ9QABC888001' },
        userId: { type: 'string', example: 'usr_01HXZ9QABC123456' },
        enrollmentId: { type: 'string', example: 'enr_01HXZ9QABC999001' },
        amount: { type: 'number', format: 'float', example: 49.99 },
        currency: { type: 'string', example: 'USD' },
        method: {
          type: 'string',
          enum: ['stellar', 'stripe', 'paypal'],
          example: 'stellar',
        },
        status: {
          type: 'string',
          enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
          example: 'completed',
        },
        stellarTxHash: {
          type: 'string',
          nullable: true,
          example:
            'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-02-01T12:05:00.000Z',
        },
      },
    },

    PaymentIntentRequest: {
      type: 'object',
      required: ['enrollmentId', 'method', 'amount', 'currency'],
      properties: {
        enrollmentId: { type: 'string', example: 'enr_01HXZ9QABC999001' },
        method: {
          type: 'string',
          enum: ['stellar', 'stripe', 'paypal'],
          example: 'stellar',
        },
        amount: { type: 'number', example: 49.99 },
        currency: { type: 'string', example: 'USD' },
        metadata: {
          type: 'object',
          nullable: true,
          properties: {
            courseId: { type: 'string', example: 'course_01HXZ9QABC123456' },
          },
        },
      },
    },

    // ── Transaction ─────────────────────────────────────────────────────────
    Transaction: {
      type: 'object',
      properties: {
        transactionId: {
          type: 'string',
          example: 'txn_01HXZ9QABC777001',
        },
        userId: { type: 'string', example: 'usr_01HXZ9QABC123456' },
        type: { type: 'string', example: 'payment' },
        status: {
          type: 'string',
          enum: ['pending', 'processing', 'completed', 'failed'],
          example: 'completed',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          example: 'medium',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-02-01T12:05:00.000Z',
        },
      },
    },

    // ── Quiz ────────────────────────────────────────────────────────────────
    Quiz: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'quiz_01HXZ9QABC666001' },
        title: { type: 'string', example: 'Blockchain Basics Quiz' },
        courseId: { type: 'string', example: 'course_01HXZ9QABC123456' },
        questions: {
          type: 'array',
          items: { type: 'object' },
          example: [
            {
              id: 'q1',
              text: 'What is a blockchain?',
              options: ['A', 'B', 'C', 'D'],
              correctAnswer: 'A',
            },
          ],
        },
        timeLimit: {
          type: 'integer',
          description: 'Time limit in minutes',
          example: 30,
        },
        isPublished: { type: 'boolean', example: true },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-02-10T08:00:00.000Z',
        },
      },
    },

    // ── Health (Issue #178) ────────────────────────────────────────────────
    LivenessResponse: {
      type: 'object',
      description: 'Cheap, dependency-free liveness probe response.',
      required: ['status', 'timestamp', 'uptime'],
      properties: {
        status: { type: 'string', enum: ['healthy'], example: 'healthy' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Process uptime in seconds', example: 4289.31 },
      },
    },
    ShuttingDownResponse: {
      type: 'object',
      description: 'Returned with HTTP 503 once a graceful shutdown has begun.',
      required: ['status', 'timestamp'],
      properties: {
        status: { type: 'string', enum: ['shutting_down'], example: 'shutting_down' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
    DependencyReport: {
      type: 'object',
      description: 'Per-dependency result surfaced in the readiness payload.',
      required: ['status'],
      additionalProperties: true,
      properties: {
        status: { type: 'string', enum: ['up', 'down'] },
        latencyMs: { type: 'number', description: 'Probe round-trip latency in ms.' },
        httpStatus: { type: 'number', description: 'Last HTTP status (Stellar/IPFS probes only).' },
        error: { type: 'string', description: 'Error class when status is down.' },
        freeBytes: { type: 'number' },
        totalBytes: { type: 'number' },
        usagePercent: { type: 'number' },
        thresholdBytes: { type: 'number' },
        circuitBreakerOpen: { type: 'boolean' },
        latency: { type: 'number' },
        endpoint: { type: 'string', description: 'Endpoint probed for network deps.' },
      },
    },
    ReadinessResponse: {
      type: 'object',
      description: 'Aggregate readiness payload – 200 when all deps are up, 503 otherwise.',
      required: ['status', 'timestamp', 'uptime', 'cached', 'dependencies'],
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded'], example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number' },
        cached: { type: 'boolean', description: 'True when served from in-process cache.' },
        dependencies: {
          type: 'object',
          description: 'Per-dependency result (database, redis, ipfs, stellar, disk).',
          additionalProperties: { $ref: '#/components/schemas/DependencyReport' },
        },
      },
    },

    // ── Content (IPFS) ──────────────────────────────────────────────────────
    IPFSContent: {
      type: 'object',
      properties: {
        cid: { type: 'string', example: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG' },
        size: { type: 'integer', example: 204800 },
        contentType: { type: 'string', example: 'video/mp4' },
        uploadedAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-20T10:00:00.000Z',
        },
        pinned: { type: 'boolean', example: true },
      },
    },
  },
};

// ─── swagger-jsdoc options ────────────────────────────────────────────────────

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AetherMint API',
      version: '1.0.0',
      description:
        'Decentralized education platform API built on the Stellar blockchain. ' +
        'Provides endpoints for authentication, course discovery, enrollment, ' +
        'payments (Stellar XLM & fiat), quizzes, real-time collaboration, ' +
        'federated learning, quantum-resistant encryption, and swarm intelligence.',
      contact: {
        name: 'AetherMint Engineering',
        url: 'https://aethermint.io',
        email: 'dev@aethermint.io',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Local development server',
      },
      {
        url: 'https://api.aethermint.io',
        description: 'Production server',
      },
    ],
    components,
    security: [],
    tags: [
      { name: 'System', description: 'Health and meta endpoints' },
      { name: 'Authentication', description: 'Register, login, and user management' },
      { name: 'Users', description: 'User profiles, settings, and achievements' },
      { name: 'Courses', description: 'Course discovery, search, and version control' },
      { name: 'Enrollments', description: 'Course enrollment lifecycle' },
      { name: 'Payments', description: 'Stellar & fiat payment processing' },
      { name: 'Quizzes', description: 'Quiz creation, management, and submissions' },
      { name: 'Content', description: 'IPFS-backed content storage and retrieval' },
      { name: 'Transactions', description: 'Stellar transaction queue management' },
      { name: 'Analytics', description: 'Platform and learning analytics' },
      { name: 'Notifications', description: 'User notification management' },
      { name: 'Collaboration', description: 'Real-time collaboration rooms' },
      { name: 'SmartWallet', description: 'Smart contract wallet operations' },
      { name: 'FederatedLearning', description: 'Privacy-preserving federated ML' },
      { name: 'SwarmLearning', description: 'Swarm intelligence learning system' },
      { name: 'SecureComm', description: 'Quantum-resistant encrypted messaging' },
      { name: 'Holographic', description: 'Holographic content encoding/decoding' },
      { name: 'ACO', description: 'Ant Colony Optimization for learning paths' },
      { name: 'AGITutor', description: 'Adaptive AI tutoring sessions' },
      { name: 'Assignments', description: 'Assignment creation and grading' },
      { name: 'Plagiarism', description: 'Plagiarism detection and reporting' },
      { name: 'CDN', description: 'Content delivery network optimization' },
      { name: 'Events', description: 'Blockchain event logging' },
      { name: 'Sync', description: 'Cross-device data synchronization' },
      { name: 'RBAC', description: 'Role-based access control' },
      { name: 'Admin', description: 'Platform administration' },
      { name: 'Gamification', description: 'Achievements, badges, and leaderboards' },
      { name: 'Bridge', description: 'Cross-chain messaging bridge' },
      { name: 'TimeLock', description: 'Time-locked credential issuance' },
      { name: 'Translation', description: 'Real-time content translation' },
      { name: 'VRF', description: 'Verifiable Random Function service' },
      { name: 'Offline', description: 'Offline content download management' },
      { name: 'Optimization', description: 'Learning path optimization' },
      { name: 'Prediction', description: 'Student outcome prediction' },
      { name: 'Recommendations', description: 'Personalized course recommendations' },
      { name: 'Search', description: 'Full-text course and content search' },
      { name: 'Bookmarks', description: 'Content bookmarks and notes' },
      { name: 'Quantum', description: 'Quantum computing integrations' },
      { name: 'QuantumEncryption', description: 'Quantum-resistant encryption primitives' },
      { name: 'FraudDetection', description: 'Submission fraud and plagiarism detection' },
      { name: 'Tenants', description: 'Multi-tenant management' },
      { name: 'TenantAnalytics', description: 'Cross-tenant analytics' },
      { name: 'AutonomousAgents', description: 'Autonomous AI agent management' },
      { name: 'Errors', description: 'RFC 7807 Problem Details catalog (see docs/ERROR_CATALOG.md)' },
    ],
  },
  // Scan all route, controller, and docs/schemas files for @openapi JSDoc annotations
  apis: [
    path.join(__dirname, '../routes/**/*.js'),
    path.join(__dirname, '../routes/**/*.ts'),
    path.join(__dirname, '../controllers/**/*.js'),
    path.join(__dirname, '../controllers/**/*.ts'),
    path.join(__dirname, './schemas/*.ts'),
    path.join(__dirname, './schemas/*.js'),
  ],
};

export const openApiSpec = swaggerJsdoc(options);

export default openApiSpec;

import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

/**
 * Legacy interactive Swagger spec kept for the `/api-docs` alias (Issue #254).
 *
 * Adds the RFC 7807 `ProblemDetails` component schema so that consumers
 * hitting the legacy UI still receive the standardized error envelope in
 * the generated response examples.
 */

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AetherMint Education Backend API',
      version,
      description:
        'Decentralized education platform API on Stellar blockchain. Provides endpoints for authentication, courses, quizzes, payments, collaboration, and advanced features including federated learning, quantum encryption, and swarm intelligence.',
      contact: {
        name: 'AetherMint Team',
        url: 'https://aethermint.io',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login or /api/auth/register',
        },
      },
      schemas: {
        // ── RFC 7807 Problem Details (canonical, preferred)
        ProblemDetails: {
          type: 'object',
          description:
            'RFC 7807 Problem Details object. `Content-Type: application/problem+json`.',
          required: ['type', 'title', 'status', 'detail', 'instance', 'code', 'success', 'requestId', 'timestamp'],
          properties: {
            type: {
              type: 'string',
              format: 'uri',
              example: 'https://aethermint.io/problems/validation-error',
            },
            title: { type: 'string', example: 'Validation Error' },
            status: { type: 'integer', example: 400 },
            detail: { type: 'string', example: '"email" must be a valid email' },
            instance: { type: 'string', example: 'POST /api/auth/register' },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            success: { type: 'boolean', enum: [false] },
            requestId: { type: 'string', format: 'uuid', example: '7e2c1f5a-8d2b-4e0d-9d6f-3a1d2e9b4c10' },
            timestamp: { type: 'string', format: 'date-time' },
            errors: {
              type: 'array',
              items: { $ref: '#/components/schemas/FieldValidationError' },
            },
            error: {
              type: 'object',
              deprecated: true,
              description: 'Legacy `{success:false, error:{…}}` mirror (kept for backward compat).',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Validation failed' },
                details: { type: 'object', nullable: true },
                requestId: { type: 'string', example: '7e2c1f5a-8d2b-4e0d-9d6f-3a1d2e9b4c10' },
              },
            },
          },
        },
        FieldValidationError: {
          type: 'object',
          properties: {
            field: { type: 'string', example: 'email' },
            message: { type: 'string', example: '"email" must be a valid email' },
            rule: { type: 'string', example: 'string.email' },
          },
        },

        // ── Legacy flat-error schema (kept for `/api-docs` UI that
        //    referenced it before the RFC 7807 rollout).
        Error: {
          type: 'object',
          deprecated: true,
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
            error: { type: 'string', example: 'Error code' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 10 },
            total: { type: 'integer', example: 100 },
            pages: { type: 'integer', example: 10 },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['student', 'educator', 'admin'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
            token: { type: 'string' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            transactionId: { type: 'string' },
            userId: { type: 'string' },
            type: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Enrollment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            courseId: { type: 'string' },
            status: { type: 'string', enum: ['active', 'completed', 'cancelled'] },
            progress: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    responses: {
      Problem400: {
        description: 'Bad request (RFC 7807 Problem Details).',
        content: {
          'application/problem+json': {
            schema: { $ref: '#/components/schemas/ProblemDetails' },
          },
        },
      },
      Problem401: {
        description: 'Authentication required (RFC 7807 Problem Details).',
        content: {
          'application/problem+json': {
            schema: { $ref: '#/components/schemas/ProblemDetails' },
          },
        },
      },
      Problem403: {
        description: 'Forbidden (RFC 7807 Problem Details).',
        content: {
          'application/problem+json': {
            schema: { $ref: '#/components/schemas/ProblemDetails' },
          },
        },
      },
      Problem404: {
        description: 'Resource not found (RFC 7807 Problem Details).',
        content: {
          'application/problem+json': {
            schema: { $ref: '#/components/schemas/ProblemDetails' },
          },
        },
      },
      Problem429: {
        description: 'Rate limited (RFC 7807 Problem Details).',
        content: {
          'application/problem+json': {
            schema: { $ref: '#/components/schemas/ProblemDetails' },
          },
        },
      },
      Problem500: {
        description: 'Internal server error (RFC 7807 Problem Details).',
        content: {
          'application/problem+json': {
            schema: { $ref: '#/components/schemas/ProblemDetails' },
          },
        },
      },
    },
    paths: {
      // ===== Authentication =====
      '/api/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Register a new user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'email', 'password'],
                  properties: {
                    username: { type: 'string', example: 'johndoe' },
                    email: { type: 'string', format: 'email', example: 'john@example.com' },
                    password: { type: 'string', format: 'password', example: 'securePass123' },
                    role: { type: 'string', enum: ['student', 'educator', 'admin'], default: 'student' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'User registered successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
            400: { $ref: '#/components/responses/Problem400' },
            409: { $ref: '#/components/responses/Problem409' },
            500: { $ref: '#/components/responses/Problem500' },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Authenticate user and get JWT token',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'password'],
                  properties: {
                    username: { type: 'string', example: 'johndoe' },
                    password: { type: 'string', format: 'password', example: 'securePass123' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
            400: { $ref: '#/components/responses/Problem400' },
            401: { $ref: '#/components/responses/Problem401' },
            500: { $ref: '#/components/responses/Problem500' },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

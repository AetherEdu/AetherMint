import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

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
        Error: {
          type: 'object',
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
            400: { description: 'Missing required fields or invalid role', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            409: { description: 'User already exists' },
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
            400: { description: 'Missing credentials' },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/api/auth/profile': {
        get: {
          tags: ['Authentication'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'User profile retrieved', content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } } },
            404: { description: 'User not found' },
          },
        },
        put: {
          tags: ['Authentication'],
          summary: 'Update user profile',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    username: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    currentPassword: { type: 'string', format: 'password' },
                    newPassword: { type: 'string', format: 'password' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Profile updated successfully' },
            400: { description: 'Validation error' },
            404: { description: 'User not found' },
          },
        },
      },
      '/api/auth/assign-role/{userId}': {
        put: {
          tags: ['Authentication'],
          summary: 'Assign role to user (Admin only)',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['role'],
                  properties: { role: { type: 'string', enum: ['student', 'educator', 'admin'] } },
                },
              },
            },
          },
          responses: {
            200: { description: 'Role assigned successfully' },
            400: { description: 'Invalid role' },
            404: { description: 'User not found' },
          },
        },
      },
      '/api/auth/users': {
        get: {
          tags: ['Authentication'],
          summary: 'Get all users (Admin only)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } },
            { in: 'query', name: 'role', schema: { type: 'string', enum: ['student', 'educator', 'admin'] } },
          ],
          responses: {
            200: { description: 'Users retrieved', content: { 'application/json': { schema: { type: 'object', properties: { users: { type: 'array', items: { $ref: '#/components/schemas/User' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } },
          },
        },
      },
      '/api/auth/users/{userId}': {
        delete: {
          tags: ['Authentication'],
          summary: 'Delete user (Admin only)',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'User deleted successfully' },
            400: { description: 'Cannot delete self' },
            404: { description: 'User not found' },
          },
        },
      },

      // ===== Users =====
      '/api/users/profile/{address}': {
        get: {
          tags: ['Users'],
          summary: 'Get user profile by Stellar address',
          parameters: [{ in: 'path', name: 'address', required: true, schema: { type: 'string' }, description: 'Stellar wallet address' }],
          responses: { 200: { description: 'User profile retrieved' }, 400: { description: 'Invalid address' } },
        },
        put: {
          tags: ['Users'],
          summary: 'Update user profile',
          parameters: [{ in: 'path', name: 'address', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { username: { type: 'string' }, email: { type: 'string' }, bio: { type: 'string' } } } } } },
          responses: { 200: { description: 'Profile updated' }, 400: { description: 'Validation error' } },
        },
      },
      '/api/users/settings/{userId}': {
        get: { tags: ['Users'], summary: 'Get user settings', parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Settings retrieved' } } },
        put: { tags: ['Users'], summary: 'Update user settings', parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'Settings updated' } } },
      },
      '/api/users/profile/{address}/achievements': {
        get: { tags: ['Users'], summary: 'Get user achievements', parameters: [{ in: 'path', name: 'address', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Achievements retrieved' } } },
      },
      '/api/users/profile/{address}/stats': {
        get: { tags: ['Users'], summary: 'Get user statistics', parameters: [{ in: 'path', name: 'address', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Stats retrieved' } } },
      },

      // ===== Content (IPFS) =====
      '/api/content/upload': {
        post: {
          tags: ['Content'],
          summary: 'Upload a single file to IPFS',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, metadata: { type: 'string' }, includeMetadata: { type: 'string' }, wrapWithDirectory: { type: 'string' } } } } } },
          responses: { 201: { description: 'File uploaded successfully' }, 400: { description: 'Upload failed' } },
        },
      },
      '/api/content/upload/batch': {
        post: {
          tags: ['Content'],
          summary: 'Upload multiple files to IPFS',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } }, metadata: { type: 'string' } } } } } },
          responses: { 201: { description: 'Files uploaded successfully' } },
        },
      },
      '/api/content/{cid}': {
        get: { tags: ['Content'], summary: 'Retrieve content from IPFS by CID', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'cid', required: true, schema: { type: 'string' } }, { in: 'query', name: 'format', schema: { type: 'string', enum: ['buffer', 'base64', 'stream'] } }], responses: { 200: { description: 'Content retrieved' }, 404: { description: 'Content not found' } } },
      },
      '/api/content/{cid}/metadata': {
        get: { tags: ['Content'], summary: 'Retrieve metadata for IPFS content', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'cid', required: true, schema: { type: 'string' } }, { in: 'query', name: 'metadataCid', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Metadata retrieved' } } },
      },
      '/api/content/{cid}/pin': {
        post: { tags: ['Content'], summary: 'Pin content to IPFS', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'cid', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Content pinned' } } },
        delete: { tags: ['Content'], summary: 'Unpin content from IPFS', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'cid', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Content unpinned' } } },
      },
      '/api/content/node/info': {
        get: { tags: ['Content'], summary: 'Get IPFS node information', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Node info retrieved' } } },
      },
      '/api/content/cache/stats': {
        get: { tags: ['Content'], summary: 'Get IPFS cache statistics', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Cache stats retrieved' } } },
      },
      '/api/content/cache': {
        delete: { tags: ['Content'], summary: 'Clear IPFS cache', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Cache cleared' } } },
      },
      '/api/content/health': {
        get: { tags: ['Content'], summary: 'IPFS service health check', responses: { 200: { description: 'Service healthy' }, 503: { description: 'Service unhealthy' } } },
      },

      // ===== Courses =====
      '/api/courses/{contentId}/versions': {
        post: {
          tags: ['Courses'],
          summary: 'Create a new version for course content',
          parameters: [{ in: 'path', name: 'contentId', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, content: { type: 'object' }, changes: { type: 'array', items: { type: 'string' } }, createdBy: { type: 'string' } } } } } },
          responses: { 201: { description: 'Version created successfully' }, 500: { description: 'Server error' } },
        },
        get: {
          tags: ['Courses'],
          summary: 'Get version history for course content',
          parameters: [{ in: 'path', name: 'contentId', required: true, schema: { type: 'string' } }, { in: 'query', name: 'page', schema: { type: 'integer' } }, { in: 'query', name: 'limit', schema: { type: 'integer' } }],
          responses: { 200: { description: 'Version history retrieved' } },
        },
      },
      '/api/courses/{contentId}/versions/current': {
        get: { tags: ['Courses'], summary: 'Get current version of course content', parameters: [{ in: 'path', name: 'contentId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Current version retrieved' } } },
      },
      '/api/courses/{contentId}/versions/{versionNumber}': {
        get: { tags: ['Courses'], summary: 'Get specific version by version number', parameters: [{ in: 'path', name: 'contentId', required: true, schema: { type: 'string' } }, { in: 'path', name: 'versionNumber', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Version retrieved' } } },
      },
      '/api/courses/versions/compare/{version1Id}/{version2Id}': {
        post: { tags: ['Courses'], summary: 'Compare two versions', parameters: [{ in: 'path', name: 'version1Id', required: true, schema: { type: 'string' } }, { in: 'path', name: 'version2Id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Versions compared' } } },
      },
      '/api/courses/{contentId}/versions/restore': {
        post: { tags: ['Courses'], summary: 'Restore content to a specific version', parameters: [{ in: 'path', name: 'contentId', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { versionId: { type: 'string' }, restoreReason: { type: 'string' }, restoredBy: { type: 'string' } } } } } }, responses: { 200: { description: 'Content restored' } } },
      },
      '/api/courses/{contentId}/versions/settings': {
        put: { tags: ['Courses'], summary: 'Update version control settings', parameters: [{ in: 'path', name: 'contentId', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { autoVersioning: { type: 'boolean' }, maxVersions: { type: 'integer' } } } } } }, responses: { 200: { description: 'Settings updated' } } },
      },
      '/api/courses/{contentId}/versions/export': {
        get: { tags: ['Courses'], summary: 'Export version history', parameters: [{ in: 'path', name: 'contentId', required: true, schema: { type: 'string' } }, { in: 'query', name: 'format', schema: { type: 'string', enum: ['json', 'csv'] } }], responses: { 200: { description: 'Version history exported' } } },
      },
      '/api/courses/{contentId}/versions/statistics': {
        get: { tags: ['Courses'], summary: 'Get version statistics for content', parameters: [{ in: 'path', name: 'contentId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Version statistics retrieved' } } },
      },

      // ===== Quizzes =====
      '/api/quizzes': {
        post: { tags: ['Quizzes'], summary: 'Create a new quiz', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, questions: { type: 'array' }, timeLimit: { type: 'integer' } } } } } }, responses: { 200: { description: 'Quiz created' } } },
        get: { tags: ['Quizzes'], summary: 'Get all quizzes', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Quizzes retrieved' } } },
      },
      '/api/quizzes/{id}': {
        get: { tags: ['Quizzes'], summary: 'Get quiz by ID', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Quiz retrieved' }, 404: { description: 'Quiz not found' } } },
        put: { tags: ['Quizzes'], summary: 'Update quiz', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Quiz updated' } } },
        delete: { tags: ['Quizzes'], summary: 'Delete quiz', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Quiz deleted' } } },
      },
      '/api/quizzes/{id}/publish': {
        post: { tags: ['Quizzes'], summary: 'Toggle quiz publish status', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Publish status toggled' } } },
      },
      '/api/quizzes/{id}/submit': {
        post: { tags: ['Quizzes'], summary: 'Submit quiz answers', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { answers: { type: 'array' } } } } } }, responses: { 200: { description: 'Submission received' } } },
      },
      '/api/quizzes/{id}/results': {
        get: { tags: ['Quizzes'], summary: 'Get quiz results', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Results retrieved' } } },
      },
      '/api/quizzes/{id}/statistics': {
        get: { tags: ['Quizzes'], summary: 'Get quiz statistics', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Statistics retrieved' } } },
      },
      '/api/quizzes/health': {
        get: { tags: ['Quizzes'], summary: 'Quiz service health check', responses: { 200: { description: 'Service healthy' } } },
      },

      // ===== Events =====
      '/api/events/course-completion': {
        post: { tags: ['Events'], summary: 'Log course completion event', responses: { 200: { description: 'Event logged' } } },
      },
      '/api/events/credential-issuance': {
        post: { tags: ['Events'], summary: 'Log credential issuance event', responses: { 200: { description: 'Event logged' } } },
      },
      '/api/events/user-achievement': {
        post: { tags: ['Events'], summary: 'Log user achievement event', responses: { 200: { description: 'Event logged' } } },
      },
      '/api/events/user/{userId}/events': {
        get: { tags: ['Events'], summary: 'Get events by user', parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Events retrieved' } } },
      },
      '/api/events/recent': {
        get: { tags: ['Events'], summary: 'Get recent events', responses: { 200: { description: 'Recent events retrieved' } } },
      },
      '/api/events/verify/{eventId}': {
        get: { tags: ['Events'], summary: 'Verify event', parameters: [{ in: 'path', name: 'eventId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Event verified' } } },
      },

      // ===== Sync =====
      '/api/sync/devices/register': {
        post: { tags: ['Sync'], summary: 'Register device for sync', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { deviceId: { type: 'string' }, platform: { type: 'string' } } } } } }, responses: { 200: { description: 'Device registered' } } },
      },
      '/api/sync/devices/{deviceId}': {
        delete: { tags: ['Sync'], summary: 'Unregister device', parameters: [{ in: 'path', name: 'deviceId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Device unregistered' } } },
      },
      '/api/sync/sync': {
        post: { tags: ['Sync'], summary: 'Sync entity data across devices', responses: { 200: { description: 'Data synced' } } },
      },
      '/api/sync/queue': {
        post: { tags: ['Sync'], summary: 'Enqueue sync operation for offline processing', responses: { 200: { description: 'Operation queued' } } },
      },
      '/api/sync/queue/status': {
        get: { tags: ['Sync'], summary: 'Get queue sync status', responses: { 200: { description: 'Queue status retrieved' } } },
      },

      // ===== RBAC =====
      '/api/rbac/assign-role': {
        post: { tags: ['RBAC'], summary: 'Assign role to user', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string' }, role: { type: 'string' } } } } } }, responses: { 200: { description: 'Role assigned' } } },
      },
      '/api/rbac/permissions': {
        get: { tags: ['RBAC'], summary: 'Get available permissions', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Permissions retrieved' } } },
      },

      // ===== Transactions =====
      '/api/transactions': {
        post: { tags: ['Transactions'], summary: 'Create and queue a new transaction', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { sourceAccount: { type: 'string' }, destinationAccount: { type: 'string' }, amount: { type: 'string' }, asset: { type: 'object' }, priority: { type: 'string', enum: ['low', 'medium', 'high'] } } } } } }, responses: { 201: { description: 'Transaction queued', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/Transaction' } } } } } } } },
        get: { tags: ['Transactions'], summary: 'Get transactions with optional filtering', responses: { 200: { description: 'Transactions retrieved' } } },
      },
      '/api/transactions/{transactionId}': {
        get: { tags: ['Transactions'], summary: 'Get specific transaction details', parameters: [{ in: 'path', name: 'transactionId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Transaction details retrieved' }, 404: { description: 'Transaction not found' } } },
      },
      '/api/transactions/{transactionId}/status': {
        get: { tags: ['Transactions'], summary: 'Get transaction status with queue position', parameters: [{ in: 'path', name: 'transactionId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Status retrieved' } } },
      },
      '/api/transactions/{transactionId}/retry': {
        post: { tags: ['Transactions'], summary: 'Retry a failed transaction', parameters: [{ in: 'path', name: 'transactionId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Transaction queued for retry' } } },
      },
      '/api/transactions/submit': {
        post: { tags: ['Transactions'], summary: 'Submit transaction to queue', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string' }, payload: { type: 'object' }, priority: { type: 'string', enum: ['low', 'medium', 'high'] } } } } } }, responses: { 201: { description: 'Transaction submitted' } } },
      },
      '/api/transactions/queue/stats': {
        get: { tags: ['Transactions'], summary: 'Get transaction queue statistics', responses: { 200: { description: 'Queue stats retrieved' } } },
      },
      '/api/transactions/stellar/account/{accountId}': {
        get: { tags: ['Transactions'], summary: 'Get Stellar account information', parameters: [{ in: 'path', name: 'accountId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Account info retrieved' }, 404: { description: 'Account not found' } } },
      },
      '/api/transactions/stellar/fee-stats': {
        get: { tags: ['Transactions'], summary: 'Get Stellar network fee statistics', responses: { 200: { description: 'Fee stats retrieved' } } },
      },
      '/api/transactions/bulk': {
        post: { tags: ['Transactions'], summary: 'Submit bulk transactions (max 100)', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Bulk transactions submitted' } } },
      },
      '/api/transactions/analytics': {
        get: { tags: ['Transactions'], summary: 'Get transaction analytics', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Analytics retrieved' } } },
      },

      // ===== Notifications =====
      '/api/notifications/{userId}': {
        get: { tags: ['Notifications'], summary: 'Get notification history', parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Notifications retrieved' } } },
        delete: { tags: ['Notifications'], summary: 'Delete notification', parameters: [{ in: 'path', name: 'notificationId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Notification deleted' } } },
      },
      '/api/notifications/{notificationId}/read': {
        patch: { tags: ['Notifications'], summary: 'Mark notification as read', parameters: [{ in: 'path', name: 'notificationId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Marked as read' } } },
      },
      '/api/notifications/read-all': {
        patch: { tags: ['Notifications'], summary: 'Mark all notifications as read', responses: { 200: { description: 'All marked as read' } } },
      },
      '/api/notifications/{userId}/preferences': {
        get: { tags: ['Notifications'], summary: 'Get notification preferences', parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Preferences retrieved' } } },
        put: { tags: ['Notifications'], summary: 'Update notification preferences', parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Preferences updated' } } },
      },

      // ===== Collaboration =====
      '/api/collaboration/rooms': {
        post: { tags: ['Collaboration'], summary: 'Create collaboration room', responses: { 200: { description: 'Room created' } } },
        get: { tags: ['Collaboration'], summary: 'List collaboration rooms', responses: { 200: { description: 'Rooms listed' } } },
      },
      '/api/collaboration/rooms/{roomId}': {
        get: { tags: ['Collaboration'], summary: 'Get room by ID', parameters: [{ in: 'path', name: 'roomId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Room details' } } },
      },
      '/api/collaboration/rooms/{roomId}/end': {
        post: { tags: ['Collaboration'], summary: 'End collaboration room', parameters: [{ in: 'path', name: 'roomId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Room ended' } } },
      },

      // ===== Holographic =====
      '/api/holographic/encode': {
        post: { tags: ['Holographic'], summary: 'Encode content using holographic storage', responses: { 200: { description: 'Content encoded' } } },
      },
      '/api/holographic/decode/{hash}': {
        get: { tags: ['Holographic'], summary: 'Decode holographic content', parameters: [{ in: 'path', name: 'hash', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Content decoded' } } },
      },
      '/api/holographic/metrics': {
        get: { tags: ['Holographic'], summary: 'Get holographic storage metrics', responses: { 200: { description: 'Metrics retrieved' } } },
      },
      '/api/holographic/optimize': {
        post: { tags: ['Holographic'], summary: 'Optimize holographic storage', responses: { 200: { description: 'Storage optimized' } } },
      },

      // ===== Secure Communication =====
      '/api/secure-comm/generate-keypair': {
        post: { tags: ['SecureComm'], summary: 'Generate quantum-resistant key pair', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Key pair generated' } } },
      },
      '/api/secure-comm/establish-secret': {
        post: { tags: ['SecureComm'], summary: 'Establish shared secret between users', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Shared secret established' } } },
      },
      '/api/secure-comm/encrypt': {
        post: { tags: ['SecureComm'], summary: 'Encrypt message', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Message encrypted' } } },
      },
      '/api/secure-comm/decrypt': {
        post: { tags: ['SecureComm'], summary: 'Decrypt message', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Message decrypted' } } },
      },
      '/api/secure-comm/sign': {
        post: { tags: ['SecureComm'], summary: 'Sign message', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Message signed' } } },
      },
      '/api/secure-comm/stats/{userId}': {
        get: { tags: ['SecureComm'], summary: 'Get communication statistics', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Stats retrieved' } } },
      },

      // ===== ACO =====
      '/api/aco/health': {
        get: { tags: ['ACO'], summary: 'ACO system health check', responses: { 200: { description: 'Health status' } } },
      },
      '/api/aco/learning/optimize': {
        post: { tags: ['ACO'], summary: 'Optimize learning path using ant colony optimization', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { startCourse: { type: 'string' }, endCourse: { type: 'string' }, preferences: { type: 'object' } } } } } }, responses: { 200: { description: 'Path optimized' } } },
      },
      '/api/aco/resources/optimize': {
        post: { tags: ['ACO'], summary: 'Optimize resource allocation', responses: { 200: { description: 'Resources optimized' } } },
      },
      '/api/aco/swarm/statistics': {
        get: { tags: ['ACO'], summary: 'Get swarm intelligence statistics', responses: { 200: { description: 'Statistics retrieved' } } },
      },
      '/api/aco/replanning/path/{userId}': {
        get: { tags: ['ACO'], summary: 'Get user learning path', parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Path retrieved' } } },
      },

      // ===== Federated Learning =====
      '/api/federated-learning/sessions': {
        post: { tags: ['FederatedLearning'], summary: 'Initialize federated learning session', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Session initialized' } } },
      },
      '/api/federated-learning/participants': {
        post: { tags: ['FederatedLearning'], summary: 'Register participant', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Participant registered' } } },
        get: { tags: ['FederatedLearning'], summary: 'Get all participants', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Participants retrieved' } } },
      },
      '/api/federated-learning/rounds': {
        post: { tags: ['FederatedLearning'], summary: 'Start new training round', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Round started' } } },
      },
      '/api/federated-learning/models/versions': {
        get: { tags: ['FederatedLearning'], summary: 'Get model versions', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Model versions retrieved' } } },
      },
      '/api/federated-learning/analytics': {
        get: { tags: ['FederatedLearning'], summary: 'Get federated learning analytics', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Analytics retrieved' } } },
      },
      '/api/federated-learning/health': {
        get: { tags: ['FederatedLearning'], summary: 'Federated learning health check', responses: { 200: { description: 'Health status' } } },
      },
      '/api/federated-learning/initialize': {
        post: { tags: ['FederatedLearning'], summary: 'Initialize FL system with model architecture', responses: { 200: { description: 'System initialized' } } },
      },
      '/api/federated-learning/aggregate': {
        post: { tags: ['FederatedLearning'], summary: 'Perform privacy-preserving aggregation', responses: { 200: { description: 'Aggregation completed' } } },
      },
      '/api/federated-learning/privacy/budget': {
        get: { tags: ['FederatedLearning'], summary: 'Get privacy budget status', responses: { 200: { description: 'Budget status retrieved' } } },
      },

      // ===== Swarm Learning =====
      '/api/swarm-learning/initialize': {
        post: { tags: ['SwarmLearning'], summary: 'Initialize swarm learning system', security: [{ bearerAuth: [] }], responses: { 200: { description: 'System initialized' } } },
      },
      '/api/swarm-learning/swarms': {
        post: { tags: ['SwarmLearning'], summary: 'Create new swarm', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Swarm created' } } },
      },
      '/api/swarm-learning/agents': {
        post: { tags: ['SwarmLearning'], summary: 'Register agent in swarm', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Agent registered' } } },
      },
      '/api/swarm-learning/analytics': {
        get: { tags: ['SwarmLearning'], summary: 'Get swarm learning analytics', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Analytics retrieved' } } },
      },
      '/api/swarm-learning/alerts': {
        get: { tags: ['SwarmLearning'], summary: 'Get swarm alerts', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Alerts retrieved' } } },
      },
      '/api/swarm-learning/health': {
        get: { tags: ['SwarmLearning'], summary: 'Swarm learning health check', responses: { 200: { description: 'Health status' } } },
      },

      // ===== Smart Wallet =====
      '/api/smart-wallet/create': {
        post: { tags: ['SmartWallet'], summary: 'Create smart contract wallet', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Wallet created' } } },
      },
      '/api/smart-wallet/execute': {
        post: { tags: ['SmartWallet'], summary: 'Execute transaction through smart wallet', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Transaction executed' } } },
      },
      '/api/smart-wallet/activity/{walletAddress}': {
        get: { tags: ['SmartWallet'], summary: 'Get wallet activity', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'walletAddress', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Activity retrieved' } } },
      },
      '/api/smart-wallet/credentials/stats': {
        get: { tags: ['SmartWallet'], summary: 'Get credential renewal stats', responses: { 200: { description: 'Stats retrieved' } } },
      },
      '/api/smart-wallet/social-recovery/setup': {
        post: { tags: ['SmartWallet'], summary: 'Setup social recovery for wallet', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Recovery setup complete' } } },
      },
      '/api/smart-wallet/multi-sig/setup': {
        post: { tags: ['SmartWallet'], summary: 'Setup multi-signature wallet', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Multi-sig setup complete' } } },
      },
      '/api/smart-wallet/session-key/create': {
        post: { tags: ['SmartWallet'], summary: 'Create session key', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Session key created' } } },
      },

      // ===== AGI Tutor =====
      '/api/agi-tutor/session': {
        post: { tags: ['AGITutor'], summary: 'Generate personalized learning session', responses: { 200: { description: 'Session generated' } } },
      },
      '/api/agi-tutor/response': {
        post: { tags: ['AGITutor'], summary: 'Process student response and provide adaptive feedback', responses: { 200: { description: 'Response processed' } } },
      },
      '/api/agi-tutor/assessment': {
        post: { tags: ['AGITutor'], summary: 'Generate comprehensive assessment', responses: { 200: { description: 'Assessment generated' } } },
      },
      '/api/agi-tutor/guidance': {
        post: { tags: ['AGITutor'], summary: 'Get real-time teaching guidance', responses: { 200: { description: 'Guidance provided' } } },
      },
      '/api/agi-tutor/visualization': {
        get: { tags: ['AGITutor'], summary: 'Get knowledge visualization', responses: { 200: { description: 'Visualization retrieved' } } },
      },

      // ===== Analytics =====
      '/api/analytics/overview': {
        get: { tags: ['Analytics'], summary: 'Get analytics overview statistics', responses: { 200: { description: 'Overview stats retrieved' } } },
      },
      '/api/analytics/report': {
        get: { tags: ['Analytics'], summary: 'Get detailed analytics report', responses: { 200: { description: 'Report retrieved' } } },
      },
      '/api/analytics/export': {
        get: { tags: ['Analytics'], summary: 'Export analytics data', responses: { 200: { description: 'Data exported' } } },
      },

      // ===== Autonomous Agents =====
      '/api/autonomous-agents/status': {
        get: { tags: ['AutonomousAgents'], summary: 'Get autonomous agent system status', responses: { 200: { description: 'System status retrieved' } } },
      },
      '/api/autonomous-agents/support/ticket': {
        post: { tags: ['AutonomousAgents'], summary: 'Submit support ticket for autonomous handling', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId', 'title', 'description'], properties: { userId: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string', default: 'normal' }, category: { type: 'string', default: 'general' } } } } } }, responses: { 200: { description: 'Ticket handled' } } },
      },
      '/api/autonomous-agents/security/status': {
        get: { tags: ['AutonomousAgents'], summary: 'Get current security posture', responses: { 200: { description: 'Security status retrieved' } } },
      },
      '/api/autonomous-agents/agents/{type}': {
        get: { tags: ['AutonomousAgents'], summary: 'Get specific agent status', parameters: [{ in: 'path', name: 'type', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Agent status retrieved' } } },
      },

      // ===== Gamification =====
      '/api/gamification/leaderboard': {
        get: { tags: ['Gamification'], summary: 'Get leaderboard', parameters: [{ in: 'query', name: 'category', schema: { type: 'string' } }, { in: 'query', name: 'page', schema: { type: 'integer' } }, { in: 'query', name: 'limit', schema: { type: 'integer' } }], responses: { 200: { description: 'Leaderboard retrieved' } } },
      },
      '/api/gamification/user/{userId}/achievements': {
        get: { tags: ['Gamification'], summary: 'Get user achievements', parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Achievements retrieved' } } },
      },
      '/api/gamification/event': {
        post: { tags: ['Gamification'], summary: 'Process gamification event', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId', 'event'], properties: { userId: { type: 'string' }, event: { type: 'string' }, data: { type: 'object' } } } } } }, responses: { 200: { description: 'Event processed' } } },
      },
      '/api/gamification/challenges': {
        get: { tags: ['Gamification'], summary: 'Get active challenges', responses: { 200: { description: 'Challenges retrieved' } } },
      },
      '/api/gamification/challenges/{challengeId}/join': {
        post: { tags: ['Gamification'], summary: 'Join a challenge', parameters: [{ in: 'path', name: 'challengeId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Joined challenge' } } },
      },

      // ===== Admin =====
      '/api/admin/dashboard': {
        get: { tags: ['Admin'], summary: 'Get admin dashboard statistics', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Dashboard statistics retrieved' } } },
      },
      '/api/admin/logs': {
        get: { tags: ['Admin'], summary: 'Get system logs', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'level', schema: { type: 'string', default: 'info' } }, { in: 'query', name: 'page', schema: { type: 'integer' } }, { in: 'query', name: 'limit', schema: { type: 'integer' } }], responses: { 200: { description: 'System logs retrieved' } } },
      },
      '/api/admin/settings': {
        get: { tags: ['Admin'], summary: 'Get system settings', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Settings retrieved' } } },
        put: { tags: ['Admin'], summary: 'Update system settings', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { category: { type: 'string' }, settings: { type: 'object' } } } } } }, responses: { 200: { description: 'Settings updated' } } },
      },
      '/api/admin/backup': {
        post: { tags: ['Admin'], summary: 'Initiate system backup', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Backup initiated' } } },
      },
      '/api/admin/announcements': {
        post: { tags: ['Admin'], summary: 'Create system announcement', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title', 'message'], properties: { title: { type: 'string' }, message: { type: 'string' }, targetRoles: { type: 'array', items: { type: 'string' } }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] } } } } } }, responses: { 201: { description: 'Announcement created' } } },
      },

      // ===== Enrollments =====
      '/api/enrollments': {
        get: { tags: ['Enrollments'], summary: 'Get user enrollments', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Enrollments retrieved', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Enrollment' } } } } } } } } },
        post: { tags: ['Enrollments'], summary: 'Create enrollment', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { courseId: { type: 'string' }, userId: { type: 'string' } } } } } }, responses: { 200: { description: 'Enrollment created' } } },
      },
      '/api/enrollments/{id}': {
        get: { tags: ['Enrollments'], summary: 'Get enrollment by ID', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Enrollment details' } } },
        put: { tags: ['Enrollments'], summary: 'Update enrollment', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Enrollment updated' } } },
        delete: { tags: ['Enrollments'], summary: 'Cancel enrollment', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Enrollment cancelled' } } },
      },
      '/api/enrollments/{id}/progress': {
        get: { tags: ['Enrollments'], summary: 'Get enrollment progress', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Progress retrieved' } } },
        put: { tags: ['Enrollments'], summary: 'Update enrollment progress', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Progress updated' } } },
      },
      '/api/enrollments/{id}/certificate': {
        post: { tags: ['Enrollments'], summary: 'Issue certificate for completed enrollment', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Certificate issued' } } },
      },
      '/api/enrollments/bulk': {
        post: { tags: ['Enrollments'], summary: 'Bulk enrollment operations', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Bulk operation complete' } } },
      },

      // ===== Payments =====
      '/api/payments/intent': {
        post: { tags: ['Payments'], summary: 'Create payment intent', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Payment intent created' } } },
      },
      '/api/payments/{id}': {
        get: { tags: ['Payments'], summary: 'Get payment by ID', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Payment details' } } },
      },
      '/api/payments/history': {
        get: { tags: ['Payments'], summary: 'Get user payment history', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Payment history retrieved' } } },
      },
      '/api/payments/stellar/create': {
        post: { tags: ['Payments'], summary: 'Create Stellar payment', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Payment created' } } },
      },
      '/api/payments/stellar/balance/{address}': {
        get: { tags: ['Payments'], summary: 'Get Stellar balance', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'address', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Balance retrieved' } } },
      },
      '/api/payments/exchange-rates': {
        get: { tags: ['Payments'], summary: 'Get exchange rates', responses: { 200: { description: 'Exchange rates retrieved' } } },
      },
      '/api/payments/settings': {
        get: { tags: ['Payments'], summary: 'Get payment settings', responses: { 200: { description: 'Payment settings retrieved' } } },
        put: { tags: ['Payments'], summary: 'Update payment settings', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Settings updated' } } },
      },

      // ===== Plagiarism Detection =====
      '/api/plagiarism/analyze': {
        post: { tags: ['Plagiarism'], summary: 'Analyze submission for plagiarism', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['submissionId', 'content'], properties: { submissionId: { type: 'string', format: 'uuid' }, content: { type: 'string' }, contentType: { type: 'string', enum: ['text', 'code', 'mixed'] } } } } } }, responses: { 200: { description: 'Analysis complete' } } },
      },
      '/api/plagiarism/reports/{reportId}': {
        get: { tags: ['Plagiarism'], summary: 'Get plagiarism report', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'reportId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Report retrieved' } } },
      },
      '/api/plagiarism/settings': {
        get: { tags: ['Plagiarism'], summary: 'Get plagiarism detection settings', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Settings retrieved' } } },
        put: { tags: ['Plagiarism'], summary: 'Update plagiarism detection settings', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Settings updated' } } },
      },
      '/api/plagiarism/health': {
        get: { tags: ['Plagiarism'], summary: 'Plagiarism detection health check', responses: { 200: { description: 'Service healthy' } } },
      },

      // ===== Assignments =====
      '/api/assignments/courses/{courseId}/assignments': {
        post: { tags: ['Assignments'], summary: 'Create assignment for course', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'courseId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Assignment created' } } },
        get: { tags: ['Assignments'], summary: 'Get course assignments', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'courseId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Assignments retrieved' } } },
      },
      '/api/assignments/assignments/{assignmentId}': {
        get: { tags: ['Assignments'], summary: 'Get assignment details', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'assignmentId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Assignment details' } } },
        put: { tags: ['Assignments'], summary: 'Update assignment', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'assignmentId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Assignment updated' } } },
        delete: { tags: ['Assignments'], summary: 'Delete assignment', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'assignmentId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Assignment deleted' } } },
      },
      '/api/assignments/assignments/{assignmentId}/submissions': {
        post: { tags: ['Assignments'], summary: 'Submit assignment', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'assignmentId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Submission received' } } },
        get: { tags: ['Assignments'], summary: 'Get submissions for assignment', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'assignmentId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Submissions retrieved' } } },
      },
      '/api/assignments/submissions/{submissionId}/grade': {
        post: { tags: ['Assignments'], summary: 'Grade submission', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'submissionId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Submission graded' } } },
      },

      // ===== CDN Optimization =====
      '/api/cdn/optimize': {
        post: { tags: ['CDN'], summary: 'Optimize content delivery', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { contentId: { type: 'string' }, contentType: { type: 'string', enum: ['video', 'image', 'audio', 'document', 'other'] }, originalUrl: { type: 'string' } } } } } }, responses: { 200: { description: 'Content optimized' } } },
      },
      '/api/cdn/statistics': {
        get: { tags: ['CDN'], summary: 'Get optimization statistics', responses: { 200: { description: 'Statistics retrieved' } } },
      },
      '/api/cdn/configuration': {
        put: { tags: ['CDN'], summary: 'Update CDN service configuration', responses: { 200: { description: 'Configuration updated' } } },
      },
      '/api/cdn/health': {
        get: { tags: ['CDN'], summary: 'CDN health check', responses: { 200: { description: 'Health status' } } },
      },

      // ===== Bridge (Cross-Protocol) =====
      '/api/bridge/send': {
        post: { tags: ['Bridge'], summary: 'Send cross-chain message', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { destinationChain: { type: 'integer' }, payload: { type: 'string' }, messageType: { type: 'string' }, gasLimit: { type: 'integer' } } } } } }, responses: { 201: { description: 'Message sent' } } },
      },
      '/api/bridge/message/{messageId}': {
        get: { tags: ['Bridge'], summary: 'Get cross-chain message details', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'messageId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Message retrieved' }, 404: { description: 'Message not found' } } },
      },
      '/api/bridge/stats': {
        get: { tags: ['Bridge'], summary: 'Get bridge statistics', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Statistics retrieved' } } },
      },
      '/api/bridge/gas-cost/{destinationChain}/{gasLimit}': {
        get: { tags: ['Bridge'], summary: 'Calculate gas cost for cross-chain message', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'destinationChain', required: true, schema: { type: 'integer' } }, { in: 'path', name: 'gasLimit', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Gas cost calculated' } } },
      },

      // ===== Time-Lock Credentials =====
      '/api/time-lock/issue': {
        post: { tags: ['TimeLock'], summary: 'Issue time-locked credential', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['recipient', 'credentialHash', 'metadata', 'releaseTime'], properties: { recipient: { type: 'string' }, credentialHash: { type: 'string' }, metadata: { type: 'object', description: 'Credential metadata' }, releaseTime: { type: 'string', format: 'date-time' } } } } } }, responses: { 201: { description: 'Credential issued' } } },
      },
      '/api/time-lock/release/{credentialId}': {
        post: { tags: ['TimeLock'], summary: 'Release time-locked credential', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'credentialId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Credential released' } } },
      },
      '/api/time-lock/emergency-revoke/{credentialId}': {
        post: { tags: ['TimeLock'], summary: 'Emergency revoke credential', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'credentialId', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } } } }, responses: { 200: { description: 'Credential revoked' } } },
      },
      '/api/time-lock/batch-release': {
        post: { tags: ['TimeLock'], summary: 'Batch release multiple credentials', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Batch release completed' } } },
      },
      '/api/time-lock/recipient/{recipient}': {
        get: { tags: ['TimeLock'], summary: 'Get credentials by recipient', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'recipient', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Credentials retrieved' } } },
      },

      // ===== Translation =====
      '/api/translate/text': {
        post: { tags: ['Translation'], summary: 'Translate text content', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['text', 'sourceLanguage', 'targetLanguage'], properties: { text: { type: 'string' }, sourceLanguage: { type: 'string' }, targetLanguage: { type: 'string' }, contentType: { type: 'string', enum: ['course', 'subtitle', 'interaction', 'general'] } } } } } }, responses: { 200: { description: 'Translation complete' } } },
      },
      '/api/translate/batch': {
        post: { tags: ['Translation'], summary: 'Batch translate multiple texts', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Batch translation complete' } } },
      },
      '/api/translate/subtitles': {
        post: { tags: ['Translation'], summary: 'Translate and synchronize subtitles', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Subtitle translation complete' } } },
      },
      '/api/translate/quality/{contentType}': {
        get: { tags: ['Translation'], summary: 'Get translation quality metrics', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'contentType', schema: { type: 'string' } }], responses: { 200: { description: 'Quality metrics retrieved' } } },
      },

      // ===== VRF =====
      '/api/vrf/request': {
        post: { tags: ['VRF'], summary: 'Request verifiable random number', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['seed', 'purpose'], properties: { seed: { type: 'string' }, purpose: { type: 'string' }, context: { type: 'string' } } } } } }, responses: { 201: { description: 'VRF request created' } } },
      },
      '/api/vrf/generate': {
        post: { tags: ['VRF'], summary: 'Generate random number for specific purpose', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Random value generated' } } },
      },
      '/api/vrf/beacon/latest': {
        get: { tags: ['VRF'], summary: 'Get latest randomness beacon', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Beacon retrieved' } } },
      },
      '/api/vrf/stats': {
        get: { tags: ['VRF'], summary: 'Get VRF system statistics', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Statistics retrieved' } } },
      },
      '/api/vrf/commit': {
        post: { tags: ['VRF'], summary: 'Commit to a value (commit-reveal scheme)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Commitment recorded' } } },
      },

      // ===== Offline =====
      '/api/offline': {
        get: { tags: ['Offline'], summary: 'Get offline content for user', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Offline content retrieved' } } },
      },
      '/api/offline/request': {
        post: { tags: ['Offline'], summary: 'Request content for offline download', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['contentId', 'deviceId'], properties: { contentId: { type: 'string' }, deviceId: { type: 'string' }, quality: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' } } } } } }, responses: { 200: { description: 'Download queued' } } },
      },
      '/api/offline/storage/{deviceId}': {
        get: { tags: ['Offline'], summary: 'Get storage usage for device', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'deviceId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Storage info retrieved' } } },
      },
      '/api/offline/{offlineId}': {
        delete: { tags: ['Offline'], summary: 'Delete offline content', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'offlineId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Content deleted' } } },
      },

      // ===== Optimization =====
      '/api/optimization/initialize': {
        post: { tags: ['Optimization'], summary: 'Initialize optimization services', responses: { 200: { description: 'Services initialized' } } },
      },
      '/api/optimization/learning-paths/optimize': {
        post: { tags: ['Optimization'], summary: 'Optimize learning path', responses: { 200: { description: 'Path optimized' } } },
      },
      '/api/optimization/analytics': {
        get: { tags: ['Optimization'], summary: 'Get optimization analytics', responses: { 200: { description: 'Analytics retrieved' } } },
      },
      '/api/optimization/health': {
        get: { tags: ['Optimization'], summary: 'Optimization service health check', responses: { 200: { description: 'Health status' } } },
      },

      // ===== Prediction =====
      '/api/prediction/students/{studentId}/predict': {
        post: { tags: ['Prediction'], summary: 'Predict student outcomes', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { studentData: { type: 'object' } } } } } }, parameters: [{ in: 'path', name: 'studentId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Prediction generated' } } },
      },
      '/api/prediction/at-risk/identify': {
        post: { tags: ['Prediction'], summary: 'Identify at-risk students', responses: { 200: { description: 'At-risk students identified' } } },
      },
      '/api/prediction/models/accuracy': {
        get: { tags: ['Prediction'], summary: 'Get model accuracy metrics', responses: { 200: { description: 'Accuracy metrics retrieved' } } },
      },
      '/api/prediction/health': {
        get: { tags: ['Prediction'], summary: 'Prediction service health check', responses: { 200: { description: 'Service healthy' } } },
      },

      // ===== Bookmark =====
      '/api/bookmarks': {
        get: { tags: ['Bookmarks'], summary: 'Get all bookmarks for user', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Bookmarks retrieved' } } },
        post: { tags: ['Bookmarks'], summary: 'Create or update bookmark', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['contentId', 'timestamp'], properties: { contentId: { type: 'string' }, timestamp: { type: 'number' }, note: { type: 'string' } } } } } }, responses: { 200: { description: 'Bookmark created/updated' } } },
      },
      '/api/bookmarks/{bookmarkId}': {
        delete: { tags: ['Bookmarks'], summary: 'Delete bookmark', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'bookmarkId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Bookmark deleted' } } },
      },
      '/api/bookmarks/notes': {
        get: { tags: ['Bookmarks'], summary: 'Get all notes for user', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Notes retrieved' } } },
        post: { tags: ['Bookmarks'], summary: 'Create note', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['contentId', 'timestamp', 'text'], properties: { contentId: { type: 'string' }, timestamp: { type: 'number' }, text: { type: 'string' }, isPrivate: { type: 'boolean', default: true }, tags: { type: 'array', items: { type: 'string' } } } } } } }, responses: { 201: { description: 'Note created' } } },
      },
      '/api/bookmarks/notes/{noteId}': {
        put: { tags: ['Bookmarks'], summary: 'Update note', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'noteId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Note updated' } } },
        delete: { tags: ['Bookmarks'], summary: 'Delete note', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'noteId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Note deleted' } } },
      },

      // ===== Quantum =====
      '/api/quantum/providers': {
        get: { tags: ['Quantum'], summary: 'Get available quantum providers', responses: { 200: { description: 'Providers listed' } } },
      },
      '/api/quantum/execute': {
        post: { tags: ['Quantum'], summary: 'Execute quantum circuit', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { circuit: { type: 'object' }, shots: { type: 'integer', default: 1024 }, provider: { type: 'string' } } } } } }, responses: { 200: { description: 'Circuit executed' } } },
      },
      '/api/quantum/health': {
        get: { tags: ['Quantum'], summary: 'Quantum services health check', responses: { 200: { description: 'Health status' } } },
      },

      // ===== Quantum Encryption =====
      '/api/quantum-encryption/keys/generate': {
        post: { tags: ['QuantumEncryption'], summary: 'Generate quantum-resistant key pair', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { algorithm: { type: 'string', enum: ['CRYSTALS_KYBER', 'CRYSTALS_DILITHIUM', 'FALCON'], default: 'CRYSTALS_KYBER' }, securityLevel: { type: 'integer', default: 4 } } } } } }, responses: { 200: { description: 'Key pair generated' } } },
      },
      '/api/quantum-encryption/encrypt': {
        post: { tags: ['QuantumEncryption'], summary: 'Encrypt data using quantum-resistant encryption', responses: { 200: { description: 'Data encrypted' } } },
      },
      '/api/quantum-encryption/decrypt': {
        post: { tags: ['QuantumEncryption'], summary: 'Decrypt quantum-encrypted data', responses: { 200: { description: 'Data decrypted' } } },
      },
      '/api/quantum-encryption/sign': {
        post: { tags: ['QuantumEncryption'], summary: 'Sign data with quantum-resistant signature', responses: { 200: { description: 'Data signed' } } },
      },
      '/api/quantum-encryption/health': {
        get: { tags: ['QuantumEncryption'], summary: 'Quantum encryption system health', responses: { 200: { description: 'Health status' } } },
      },

      // ===== Fraud Detection =====
      '/api/fraud-detection/health': {
        get: { tags: ['FraudDetection'], summary: 'Fraud detection system health check', responses: { 200: { description: 'Health status' } } },
      },
      '/api/fraud-detection/analyze-submission': {
        post: { tags: ['FraudDetection'], summary: 'Analyze submission for plagiarism', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['submissionId', 'userId', 'assignmentId', 'content'], properties: { submissionId: { type: 'string' }, userId: { type: 'string' }, assignmentId: { type: 'string' }, content: { type: 'string' } } } } } }, responses: { 200: { description: 'Analysis complete' } } },
      },
      '/api/fraud-detection/statistics': {
        get: { tags: ['FraudDetection'], summary: 'Get fraud detection statistics', responses: { 200: { description: 'Statistics retrieved' } } },
      },
      '/api/fraud-detection/alerts': {
        get: { tags: ['FraudDetection'], summary: 'Get fraud alerts', responses: { 200: { description: 'Alerts retrieved' } } },
      },

      // ===== Search =====
      '/api/search': {
        get: { tags: ['Search'], summary: 'Search courses and content', parameters: [{ in: 'query', name: 'q', schema: { type: 'string' } }, { in: 'query', name: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Search results' } } },
      },
      '/api/search/suggestions': {
        get: { tags: ['Search'], summary: 'Get search suggestions', responses: { 200: { description: 'Suggestions retrieved' } } },
      },
      '/api/search/voice': {
        post: { tags: ['Search'], summary: 'Voice search', responses: { 200: { description: 'Voice query processed' } } },
      },
      '/api/search/trending': {
        get: { tags: ['Search'], summary: 'Get trending content', responses: { 200: { description: 'Trending content retrieved' } } },
      },

      // ===== Recommendations =====
      '/api/recommendations/user/{userId}': {
        get: { tags: ['Recommendations'], summary: 'Get personalized recommendations', parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }, { in: 'query', name: 'count', schema: { type: 'integer', default: 10 } }, { in: 'query', name: 'algorithm', schema: { type: 'string', enum: ['collaborative', 'content_based', 'hybrid'], default: 'hybrid' } }], responses: { 200: { description: 'Recommendations retrieved' } } },
      },
      '/api/recommendations/popular': {
        get: { tags: ['Recommendations'], summary: 'Get popular courses', responses: { 200: { description: 'Popular courses retrieved' } } },
      },
      '/api/recommendations/trending': {
        get: { tags: ['Recommendations'], summary: 'Get trending courses', responses: { 200: { description: 'Trending courses retrieved' } } },
      },
      '/api/recommendations/similar/{courseId}': {
        get: { tags: ['Recommendations'], summary: 'Get courses similar to given course', parameters: [{ in: 'path', name: 'courseId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Similar courses retrieved' } } },
      },
      '/api/recommendations/models/train': {
        post: { tags: ['Recommendations'], summary: 'Train recommendation models', responses: { 200: { description: 'Training completed' } } },
      },

      // ===== Tenants =====
      '/api/tenants': {
        post: { tags: ['Tenants'], summary: 'Create new tenant', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'subdomain'], properties: { name: { type: 'string' }, subdomain: { type: 'string' }, plan: { type: 'string', enum: ['starter', 'professional', 'enterprise'] } } } } } }, responses: { 201: { description: 'Tenant created' } } },
      },
      '/api/tenants/{tenantId}/users': {
        post: { tags: ['Tenants'], summary: 'Create user in tenant', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'tenantId', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'User created' } } },
        get: { tags: ['Tenants'], summary: 'Get tenant users', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'tenantId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Users retrieved' } } },
      },
      '/api/tenants/{tenantId}/settings': {
        put: { tags: ['Tenants'], summary: 'Update tenant settings', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'tenantId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Settings updated' } } },
      },
      '/api/tenants/{tenantId}': {
        delete: { tags: ['Tenants'], summary: 'Delete tenant', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'tenantId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Tenant deleted' } } },
      },

      // ===== Tenant Analytics =====
      '/api/analytics/tenants/cross-tenant': {
        get: { tags: ['TenantAnalytics'], summary: 'Get cross-tenant analytics', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Analytics retrieved' } } },
      },
      '/api/analytics/tenants/{tenantId}': {
        get: { tags: ['TenantAnalytics'], summary: 'Get tenant-specific analytics', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'tenantId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Tenant analytics retrieved' } } },
      },

      // ===== Health =====
      '/api/health': {
        get: { tags: ['System'], summary: 'Health check endpoint', responses: { 200: { description: 'Service is healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'healthy' }, timestamp: { type: 'string', format: 'date-time' }, uptime: { type: 'number' } } } } } } } },
      },
    },
  },
  apis: [
    './src/routes/*.js',
    './src/routes/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

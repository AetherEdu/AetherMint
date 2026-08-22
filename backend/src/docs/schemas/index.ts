/**
 * @file Reusable OpenAPI component schema annotations.
 *
 * These JSDoc blocks are picked up by swagger-jsdoc via the `apis` glob in
 * openapi.ts.  Nothing is exported at runtime – the file exists solely to
 * let swagger-jsdoc parse the YAML-in-comments.
 */

/**
 * @openapi
 * components:
 *   schemas:
 *
 *     # ─── Unified error response ───────────────────────────────────────────
 *     ErrorResponse:
 *       type: object
 *       description: Standard error envelope returned by all error handlers.
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: object
 *           properties:
 *             code:
 *               type: string
 *               example: NOT_FOUND
 *             message:
 *               type: string
 *               example: Resource not found
 *             details:
 *               type: object
 *               nullable: true
 *             requestId:
 *               type: string
 *               example: req-12345
 *
 *     # ─── Pagination meta ──────────────────────────────────────────────────
 *     Pagination:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 10
 *         total:
 *           type: integer
 *           example: 100
 *         pages:
 *           type: integer
 *           example: 10
 *
 *     # ─── User ─────────────────────────────────────────────────────────────
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: usr_01HXZ9QABC123456
 *         username:
 *           type: string
 *           example: johndoe
 *         email:
 *           type: string
 *           format: email
 *           example: john@example.com
 *         role:
 *           type: string
 *           enum: [student, educator, admin]
 *           example: student
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: '2024-01-15T10:30:00.000Z'
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: '2024-06-01T08:00:00.000Z'
 *
 *     AuthResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Login successful
 *         user:
 *           $ref: '#/components/schemas/User'
 *         token:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 *     RegisterRequest:
 *       type: object
 *       required: [username, email, password]
 *       properties:
 *         username:
 *           type: string
 *           example: johndoe
 *         email:
 *           type: string
 *           format: email
 *           example: john@example.com
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           example: securePass123
 *         role:
 *           type: string
 *           enum: [student, educator, admin]
 *           default: student
 *
 *     LoginRequest:
 *       type: object
 *       required: [username, password]
 *       properties:
 *         username:
 *           type: string
 *           example: johndoe
 *         password:
 *           type: string
 *           format: password
 *           example: securePass123
 *
 *     # ─── Course ───────────────────────────────────────────────────────────
 *     Course:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: course_01HXZ9QABC123456
 *         title:
 *           type: string
 *           example: Introduction to Blockchain
 *         description:
 *           type: string
 *           example: A beginner-friendly course on blockchain fundamentals.
 *         category:
 *           type: string
 *           example: programming
 *         level:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *           example: beginner
 *         price:
 *           type: number
 *           format: float
 *           example: 49.99
 *         currency:
 *           type: string
 *           example: USD
 *         instructorId:
 *           type: string
 *           example: usr_01HXZ9QABC789012
 *         rating:
 *           type: number
 *           format: float
 *           example: 4.7
 *         enrollmentCount:
 *           type: integer
 *           example: 1250
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: '2024-01-10T09:00:00.000Z'
 *
 *     CourseSearchRequest:
 *       type: object
 *       required: [query, sessionId]
 *       properties:
 *         query:
 *           type: string
 *           example: blockchain fundamentals
 *         sessionId:
 *           type: string
 *           example: sess_abc123
 *         filters:
 *           type: object
 *           properties:
 *             category:
 *               type: string
 *               example: programming
 *             level:
 *               type: string
 *               enum: [beginner, intermediate, advanced]
 *             priceRange:
 *               type: object
 *               properties:
 *                 min:
 *                   type: number
 *                   example: 0
 *                 max:
 *                   type: number
 *                   example: 100
 *             sortBy:
 *               type: string
 *               enum: [relevance, rating, price-low, price-high, newest, popular]
 *               example: rating
 *             page:
 *               type: integer
 *               minimum: 1
 *               example: 1
 *             limit:
 *               type: integer
 *               minimum: 1
 *               maximum: 50
 *               example: 10
 *
 *     # ─── Enrollment ───────────────────────────────────────────────────────
 *     Enrollment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: enr_01HXZ9QABC999001
 *         userId:
 *           type: string
 *           example: usr_01HXZ9QABC123456
 *         courseId:
 *           type: string
 *           example: course_01HXZ9QABC123456
 *         status:
 *           type: string
 *           enum: [pending, active, completed, cancelled]
 *           example: active
 *         paymentStatus:
 *           type: string
 *           enum: [pending, completed, failed, refunded]
 *           example: completed
 *         progress:
 *           type: number
 *           format: float
 *           minimum: 0
 *           maximum: 100
 *           example: 65.5
 *         enrolledAt:
 *           type: string
 *           format: date-time
 *           example: '2024-02-01T12:00:00.000Z'
 *         completedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *
 *     CreateEnrollmentRequest:
 *       type: object
 *       required: [courseId, paymentMethod]
 *       properties:
 *         courseId:
 *           type: string
 *           example: course_01HXZ9QABC123456
 *         paymentMethod:
 *           type: string
 *           enum: [stellar, stripe, paypal, free]
 *           example: stellar
 *         paymentDetails:
 *           type: object
 *           properties:
 *             amount:
 *               type: number
 *               example: 49.99
 *             currency:
 *               type: string
 *               example: USD
 *             fromAddress:
 *               type: string
 *               example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA
 *
 *     # ─── Payment ──────────────────────────────────────────────────────────
 *     Payment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: pay_01HXZ9QABC888001
 *         userId:
 *           type: string
 *           example: usr_01HXZ9QABC123456
 *         enrollmentId:
 *           type: string
 *           example: enr_01HXZ9QABC999001
 *         amount:
 *           type: number
 *           format: float
 *           example: 49.99
 *         currency:
 *           type: string
 *           example: USD
 *         method:
 *           type: string
 *           enum: [stellar, stripe, paypal]
 *           example: stellar
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed, refunded]
 *           example: completed
 *         stellarTxHash:
 *           type: string
 *           nullable: true
 *           example: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: '2024-02-01T12:05:00.000Z'
 *
 *     PaymentIntentRequest:
 *       type: object
 *       required: [enrollmentId, method, amount, currency]
 *       properties:
 *         enrollmentId:
 *           type: string
 *           example: enr_01HXZ9QABC999001
 *         method:
 *           type: string
 *           enum: [stellar, stripe, paypal]
 *           example: stellar
 *         amount:
 *           type: number
 *           example: 49.99
 *         currency:
 *           type: string
 *           example: USD
 *         metadata:
 *           type: object
 *           nullable: true
 *           properties:
 *             courseId:
 *               type: string
 *               example: course_01HXZ9QABC123456
 *
 *     # ─── Transaction ──────────────────────────────────────────────────────
 *     Transaction:
 *       type: object
 *       properties:
 *         transactionId:
 *           type: string
 *           example: txn_01HXZ9QABC777001
 *         userId:
 *           type: string
 *           example: usr_01HXZ9QABC123456
 *         type:
 *           type: string
 *           example: payment
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *           example: completed
 *         priority:
 *           type: string
 *           enum: [low, medium, high]
 *           example: medium
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: '2024-02-01T12:05:00.000Z'
 *
 *     # ─── Quiz ─────────────────────────────────────────────────────────────
 *     Quiz:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: quiz_01HXZ9QABC666001
 *         title:
 *           type: string
 *           example: Blockchain Basics Quiz
 *         courseId:
 *           type: string
 *           example: course_01HXZ9QABC123456
 *         questions:
 *           type: array
 *           items:
 *             type: object
 *         timeLimit:
 *           type: integer
 *           description: Time limit in minutes
 *           example: 30
 *         isPublished:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: '2024-02-10T08:00:00.000Z'
 *
 *     # ─── IPFS Content ─────────────────────────────────────────────────────
 *     IPFSContent:
 *       type: object
 *       properties:
 *         cid:
 *           type: string
 *           example: QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
 *         size:
 *           type: integer
 *           example: 204800
 *         contentType:
 *           type: string
 *           example: video/mp4
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *           example: '2024-01-20T10:00:00.000Z'
 *         pinned:
 *           type: boolean
 *           example: true
 *
 *     IPFSUploadResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         cid:
 *           type: string
 *           example: QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
 *         size:
 *           type: integer
 *           example: 204800
 *         contentType:
 *           type: string
 *           example: video/mp4
 *         metadata:
 *           type: object
 *           nullable: true
 *
 *     # ─── Credential ────────────────────────────────────────────────────────
 *     Credential:
 *       type: object
 *       required: [id, recipientAddress, courseId, issuedAt, txHash]
 *       properties:
 *         id:
 *           type: string
 *           example: cred_01HXZ9QABC111001
 *         recipientAddress:
 *           type: string
 *           description: Stellar wallet address of the recipient
 *           example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA
 *         courseId:
 *           type: string
 *           example: course_01HXZ9QABC123456
 *         courseName:
 *           type: string
 *           example: Introduction to Blockchain
 *         issuerAddress:
 *           type: string
 *           example: GBPF7WBLQPIYV5ZGJMFM4QE3ZNYLCKPD4YPF5GBF6XZUV2CNBJTBW6X
 *         txHash:
 *           type: string
 *           description: Stellar transaction hash for the on-chain issuance
 *           example: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
 *         metadataCid:
 *           type: string
 *           description: IPFS CID of credential metadata
 *           example: QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
 *         isRevoked:
 *           type: boolean
 *           example: false
 *         issuedAt:
 *           type: string
 *           format: date-time
 *           example: '2024-03-15T14:00:00.000Z'
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *
 *     IssueCredentialRequest:
 *       type: object
 *       required: [recipientAddress, courseId]
 *       properties:
 *         recipientAddress:
 *           type: string
 *           example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA
 *         courseId:
 *           type: string
 *           example: course_01HXZ9QABC123456
 *         metadata:
 *           type: object
 *           nullable: true
 *           properties:
 *             grade:
 *               type: string
 *               example: A
 *             score:
 *               type: number
 *               example: 95.5
 *
 *     # ─── Holographic ──────────────────────────────────────────────────────
 *     HolographicEncodeRequest:
 *       type: object
 *       required: [contentId, data]
 *       properties:
 *         contentId:
 *           type: string
 *           example: course-101
 *         data:
 *           type: string
 *           format: byte
 *           description: Base64-encoded binary content
 *           example: SGVsbG8gV29ybGQ=
 *         compressionLevel:
 *           type: integer
 *           minimum: 0
 *           maximum: 9
 *           default: 5
 *           example: 5
 *
 *     HolographicEncodeResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         hash:
 *           type: string
 *           example: holo_a1b2c3d4e5f6
 *         densityAchieved:
 *           type: number
 *           format: float
 *           description: Storage density ratio achieved (0-1)
 *           example: 0.87
 *         encodedSize:
 *           type: integer
 *           example: 98304
 *
 *     HolographicMetrics:
 *       type: object
 *       properties:
 *         totalEncoded:
 *           type: integer
 *           example: 1024
 *         averageDensity:
 *           type: number
 *           format: float
 *           example: 0.85
 *         totalSizeSaved:
 *           type: integer
 *           description: Total bytes saved via holographic compression
 *           example: 10485760
 *         readSpeedMBps:
 *           type: number
 *           format: float
 *           example: 15000.0
 *
 *     # ─── Notification ─────────────────────────────────────────────────────
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: notif_01HXZ9QABC555001
 *         userId:
 *           type: string
 *           example: usr_01HXZ9QABC123456
 *         type:
 *           type: string
 *           enum: [enrollment, credential, payment, system, achievement]
 *           example: credential
 *         title:
 *           type: string
 *           example: New credential issued
 *         message:
 *           type: string
 *           example: Your credential for Introduction to Blockchain has been issued.
 *         read:
 *           type: boolean
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: '2024-03-15T14:05:00.000Z'
 *
 *     # ─── Gamification ─────────────────────────────────────────────────────
 *     Achievement:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: ach_01HXZ9QABC444001
 *         title:
 *           type: string
 *           example: First Course Completed
 *         description:
 *           type: string
 *           example: Successfully completed your first course on AetherMint.
 *         points:
 *           type: integer
 *           example: 100
 *         badgeUrl:
 *           type: string
 *           format: uri
 *           example: https://assets.aethermint.io/badges/first-course.svg
 *         earnedAt:
 *           type: string
 *           format: date-time
 *           example: '2024-03-15T14:05:00.000Z'
 *
 *     LeaderboardEntry:
 *       type: object
 *       properties:
 *         rank:
 *           type: integer
 *           example: 1
 *         userId:
 *           type: string
 *           example: usr_01HXZ9QABC123456
 *         username:
 *           type: string
 *           example: johndoe
 *         points:
 *           type: integer
 *           example: 4500
 *         achievements:
 *           type: integer
 *           example: 12
 *
 *     # ─── Analytics ────────────────────────────────────────────────────────
 *     AnalyticsEvent:
 *       type: object
 *       required: [eventType, userId]
 *       properties:
 *         eventType:
 *           type: string
 *           enum: [course_view, lesson_complete, quiz_attempt, enrollment, login]
 *           example: lesson_complete
 *         userId:
 *           type: string
 *           example: usr_01HXZ9QABC123456
 *         courseId:
 *           type: string
 *           nullable: true
 *           example: course_01HXZ9QABC123456
 *         metadata:
 *           type: object
 *           nullable: true
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: '2024-03-15T14:00:00.000Z'
 *
 *     # ─── Collaboration ────────────────────────────────────────────────────
 *     CollaborationRoom:
 *       type: object
 *       properties:
 *         roomId:
 *           type: string
 *           example: room_01HXZ9QABC333001
 *         courseId:
 *           type: string
 *           example: course_01HXZ9QABC123456
 *         participants:
 *           type: array
 *           items:
 *             type: string
 *           example: ['usr_01HXZ9QABC123456', 'usr_01HXZ9QABC789012']
 *         maxParticipants:
 *           type: integer
 *           example: 10
 *         status:
 *           type: string
 *           enum: [active, closed]
 *           example: active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: '2024-03-15T13:00:00.000Z'
 *
 *     # ─── Assignment ───────────────────────────────────────────────────────
 *     Assignment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: asgn_01HXZ9QABC222001
 *         courseId:
 *           type: string
 *           example: course_01HXZ9QABC123456
 *         title:
 *           type: string
 *           example: Build a Smart Contract
 *         description:
 *           type: string
 *           example: Implement a Soroban credential registry contract.
 *         dueDate:
 *           type: string
 *           format: date-time
 *           example: '2024-04-01T23:59:00.000Z'
 *         maxScore:
 *           type: number
 *           example: 100
 *         weight:
 *           type: number
 *           format: float
 *           description: Weight in final grade (0-1)
 *           example: 0.3
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: '2024-03-01T09:00:00.000Z'
 */

export {};

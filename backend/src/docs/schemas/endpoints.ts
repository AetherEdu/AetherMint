/**
 * @file Full OpenAPI endpoint annotations for the 20+ required documented paths.
 *
 * swagger-jsdoc picks this file up via the `apis` glob in openapi.ts.
 * Nothing is exported – the file exists solely for JSDoc comment scanning.
 */

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [System]
 *     summary: Service health check
 *     description: Returns the current health status, uptime, and server timestamp.
 *     responses:
 *       '200':
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   example: 3600.5
 */

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Creates a new user account and returns a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       '201':
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       '400':
 *         description: Missing required fields or invalid role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Authenticate user and get JWT token
 *     description: Validates credentials and returns a signed JWT token valid for 24 hours.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       '200':
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       '400':
 *         description: Missing credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Invalid username or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/auth/profile:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       '401':
 *         description: No token provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     tags: [Authentication]
 *     summary: Update current user profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: newusername
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newemail@example.com
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       '200':
 *         description: Profile updated successfully
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/auth/users:
 *   get:
 *     tags: [Authentication]
 *     summary: List all users (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Results per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [student, educator, admin]
 *         description: Filter by role
 *     responses:
 *       '200':
 *         description: Users retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Forbidden – admin only
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/auth/assign-role/{userId}:
 *   put:
 *     tags: [Authentication]
 *     summary: Assign role to a user (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Target user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [student, educator, admin]
 *                 example: educator
 *     responses:
 *       '200':
 *         description: Role assigned successfully
 *       '400':
 *         description: Invalid role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/auth/users/{userId}:
 *   delete:
 *     tags: [Authentication]
 *     summary: Delete a user (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of user to delete
 *     responses:
 *       '200':
 *         description: User deleted successfully
 *       '400':
 *         description: Cannot delete your own account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/users/profile/{address}:
 *   get:
 *     tags: [Users]
 *     summary: Get user profile by Stellar address
 *     description: Retrieve full user profile using their Stellar wallet address.
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Stellar wallet address (starts with G)
 *         example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA
 *     responses:
 *       '200':
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       '400':
 *         description: Invalid Stellar address format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     tags: [Users]
 *     summary: Update user profile
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe_updated
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john_new@example.com
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *                 example: Blockchain enthusiast and educator.
 *     responses:
 *       '200':
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/users/profile/{address}/achievements:
 *   get:
 *     tags: [Users]
 *     summary: Get user achievements
 *     description: Returns all badges and achievements earned by a user.
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA
 *     responses:
 *       '200':
 *         description: Achievements retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                         example: First Course Completed
 *                       earnedAt:
 *                         type: string
 *                         format: date-time
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/users/profile/{address}/stats:
 *   get:
 *     tags: [Users]
 *     summary: Get user statistics
 *     description: Returns learning statistics including courses completed, total time, and score averages.
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA
 *     responses:
 *       '200':
 *         description: Statistics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     coursesCompleted:
 *                       type: integer
 *                       example: 5
 *                     totalTimeSpent:
 *                       type: integer
 *                       description: Total seconds spent learning
 *                       example: 72000
 *                     averageScore:
 *                       type: number
 *                       format: float
 *                       example: 87.3
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/courses/search:
 *   post:
 *     tags: [Courses]
 *     summary: Search courses
 *     description: >
 *       Full-text course search with optional category, level, price, and
 *       rating filters. Returns paginated results ranked by relevance.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CourseSearchRequest'
 *     responses:
 *       '200':
 *         description: Search results returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     courses:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Course'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Search engine error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/courses/trending:
 *   get:
 *     tags: [Courses]
 *     summary: Get trending courses
 *     description: Returns the most popular courses based on recent enrollment activity.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Maximum number of trending courses to return
 *     responses:
 *       '200':
 *         description: Trending courses retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Course'
 *       '400':
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/courses/suggestions:
 *   get:
 *     tags: [Courses]
 *     summary: Get search auto-suggestions
 *     description: Returns up to 10 autocomplete suggestions for a partial search query.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Partial query string
 *         example: block
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           default: 5
 *     responses:
 *       '200':
 *         description: Suggestions returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["blockchain basics", "blockchain for beginners"]
 *       '400':
 *         description: Missing query parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/courses/recommendations:
 *   post:
 *     tags: [Courses]
 *     summary: Get personalized course recommendations
 *     description: >
 *       Returns AI-driven personalized recommendations based on the user's
 *       enrolled courses, browsing history, ratings, and preferences.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *                 example: usr_01HXZ9QABC123456
 *               enrolledCourseIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["course_01", "course_02"]
 *               preferredCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["programming", "blockchain"]
 *               preferredLevels:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["beginner", "intermediate"]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 30
 *           default: 10
 *     responses:
 *       '200':
 *         description: Recommendations generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Course'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Recommendation engine error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/enrollments:
 *   get:
 *     tags: [Enrollments]
 *     summary: Get current user's enrollments
 *     description: Returns a paginated list of all enrollments for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, completed, cancelled]
 *         description: Filter by enrollment status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: enrolledAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       '200':
 *         description: Enrollments retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Enrollment'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     tags: [Enrollments]
 *     summary: Create a new enrollment
 *     description: >
 *       Enrolls the authenticated user in a course. If the course is full,
 *       the user is added to the waitlist (202). Triggers payment intent creation.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEnrollmentRequest'
 *     responses:
 *       '201':
 *         description: Enrollment created – payment required to confirm
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     enrollment:
 *                       $ref: '#/components/schemas/Enrollment'
 *                     paymentIntent:
 *                       type: object
 *       '202':
 *         description: Course full – added to waitlist
 *       '400':
 *         description: Already enrolled or prerequisites not met
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/enrollments/{id}:
 *   get:
 *     tags: [Enrollments]
 *     summary: Get enrollment by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: enr_01HXZ9QABC999001
 *     responses:
 *       '200':
 *         description: Enrollment details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Enrollment'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     tags: [Enrollments]
 *     summary: Cancel an enrollment
 *     description: Cancels an active enrollment. Triggers a refund if payment was completed.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: enr_01HXZ9QABC999001
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Changed my mind
 *     responses:
 *       '200':
 *         description: Enrollment cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Enrollment'
 *       '400':
 *         description: Cannot cancel completed enrollment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/enrollments/{id}/progress:
 *   get:
 *     tags: [Enrollments]
 *     summary: Get enrollment progress
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: enr_01HXZ9QABC999001
 *     responses:
 *       '200':
 *         description: Progress retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     overallProgress:
 *                       type: number
 *                       format: float
 *                       example: 65.5
 *                     completedModules:
 *                       type: integer
 *                       example: 7
 *                     totalModules:
 *                       type: integer
 *                       example: 12
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     tags: [Enrollments]
 *     summary: Update enrollment progress
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: enr_01HXZ9QABC999001
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [progress]
 *             properties:
 *               progress:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 75.0
 *     responses:
 *       '200':
 *         description: Progress updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Enrollment'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/payments/intent:
 *   post:
 *     tags: [Payments]
 *     summary: Create a payment intent
 *     description: >
 *       Initiates a new payment for a course enrollment. Supports Stellar XLM,
 *       Stripe, and PayPal. Returns a payment intent object containing the
 *       information needed to complete the payment on the client side.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentIntentRequest'
 *     responses:
 *       '201':
 *         description: Payment intent created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentIntentId:
 *                       type: string
 *                       example: pi_01HXZ9QABC000001
 *                     clientSecret:
 *                       type: string
 *                       nullable: true
 *                     stellarMemo:
 *                       type: string
 *                       nullable: true
 *                       example: AETHERMINT-PAY-01HXZ9
 *       '400':
 *         description: Invalid payment parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Payment service error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/payments/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: pay_01HXZ9QABC888001
 *     responses:
 *       '200':
 *         description: Payment details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Access denied – not your payment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Payment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/payments/history:
 *   get:
 *     tags: [Payments]
 *     summary: Get current user's payment history
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed, refunded]
 *     responses:
 *       '200':
 *         description: Payment history retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/payments/stellar/balance/{address}:
 *   get:
 *     tags: [Payments]
 *     summary: Get Stellar account balance
 *     description: Returns all asset balances for a Stellar wallet address.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Stellar public key (G...)
 *         example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA
 *     responses:
 *       '200':
 *         description: Balance retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       asset:
 *                         type: string
 *                         example: XLM
 *                       balance:
 *                         type: string
 *                         example: "250.0000000"
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Stellar network error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/payments/exchange-rates:
 *   get:
 *     tags: [Payments]
 *     summary: Get current exchange rates
 *     description: Returns live exchange rates for supported currencies (XLM, USD, EUR, etc.).
 *     responses:
 *       '200':
 *         description: Exchange rates retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: number
 *                   example:
 *                     XLM_USD: 0.11
 *                     USD_EUR: 0.92
 *       '500':
 *         description: Exchange rate service error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/payments/settings:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment settings
 *     description: Returns the current platform payment configuration (accepted methods, limits, etc.).
 *     responses:
 *       '200':
 *         description: Payment settings retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     acceptedMethods:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["stellar", "stripe", "paypal"]
 *                     minAmount:
 *                       type: number
 *                       example: 1.0
 *                     maxAmount:
 *                       type: number
 *                       example: 10000.0
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     tags: [Payments]
 *     summary: Update payment settings (Admin only)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               minAmount:
 *                 type: number
 *                 example: 0.5
 *               maxAmount:
 *                 type: number
 *                 example: 50000.0
 *               acceptedMethods:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["stellar", "stripe"]
 *     responses:
 *       '200':
 *         description: Settings updated successfully
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/quizzes:
 *   post:
 *     tags: [Quizzes]
 *     summary: Create a new quiz
 *     description: Creates a quiz associated with a course. Requires educator or admin role.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, courseId, questions]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Blockchain Fundamentals Quiz
 *               courseId:
 *                 type: string
 *                 example: course_01HXZ9QABC123456
 *               questions:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                     options:
 *                       type: array
 *                       items:
 *                         type: string
 *                     correctAnswer:
 *                       type: string
 *               timeLimit:
 *                 type: integer
 *                 description: Time limit in minutes
 *                 example: 30
 *               passingScore:
 *                 type: number
 *                 format: float
 *                 example: 70.0
 *     responses:
 *       '201':
 *         description: Quiz created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Quiz'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Quizzes]
 *     summary: List all quizzes
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *         description: Filter by course ID
 *       - in: query
 *         name: published
 *         schema:
 *           type: boolean
 *         description: Filter by published status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       '200':
 *         description: Quizzes retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Quiz'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/quizzes/{id}:
 *   get:
 *     tags: [Quizzes]
 *     summary: Get quiz by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: quiz_01HXZ9QABC666001
 *     responses:
 *       '200':
 *         description: Quiz retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Quiz'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     tags: [Quizzes]
 *     summary: Update a quiz
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               questions:
 *                 type: array
 *               timeLimit:
 *                 type: integer
 *               passingScore:
 *                 type: number
 *     responses:
 *       '200':
 *         description: Quiz updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Quiz'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     tags: [Quizzes]
 *     summary: Delete a quiz
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Quiz deleted
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/quizzes/{id}/submit:
 *   post:
 *     tags: [Quizzes]
 *     summary: Submit quiz answers
 *     description: Submits a completed quiz attempt and returns a graded result.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: quiz_01HXZ9QABC666001
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     answer:
 *                       type: string
 *                 example:
 *                   - questionId: q1
 *                     answer: A
 *                   - questionId: q2
 *                     answer: C
 *               timeTaken:
 *                 type: integer
 *                 description: Time taken in seconds
 *                 example: 480
 *     responses:
 *       '200':
 *         description: Quiz submitted and graded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     score:
 *                       type: number
 *                       example: 85.0
 *                     passed:
 *                       type: boolean
 *                       example: true
 *                     correctAnswers:
 *                       type: integer
 *                       example: 17
 *                     totalQuestions:
 *                       type: integer
 *                       example: 20
 *       '400':
 *         description: Invalid submission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/content/upload:
 *   post:
 *     tags: [Content]
 *     summary: Upload a single file to IPFS
 *     description: >
 *       Uploads a file to IPFS and returns the content identifier (CID).
 *       Supports optional metadata attachment and directory wrapping.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload (max 100 MB)
 *               metadata:
 *                 type: string
 *                 description: JSON-encoded metadata object
 *                 example: '{"title":"Lecture 1","courseId":"course_01"}'
 *               includeMetadata:
 *                 type: string
 *                 enum: ["true", "false"]
 *                 default: "true"
 *               wrapWithDirectory:
 *                 type: string
 *                 enum: ["true", "false"]
 *                 default: "false"
 *     responses:
 *       '201':
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/IPFSContent'
 *       '400':
 *         description: No file provided or upload validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: IPFS upload error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/content/{cid}:
 *   get:
 *     tags: [Content]
 *     summary: Retrieve content from IPFS by CID
 *     description: Fetches stored IPFS content by its content identifier.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cid
 *         required: true
 *         schema:
 *           type: string
 *         description: IPFS Content Identifier (CIDv0 or CIDv1)
 *         example: QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [buffer, base64, stream]
 *           default: buffer
 *         description: Response format
 *     responses:
 *       '200':
 *         description: Content retrieved
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Content not found on IPFS
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: IPFS retrieval error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/content/health:
 *   get:
 *     tags: [Content]
 *     summary: IPFS service health check
 *     description: Returns IPFS node connectivity and cache statistics.
 *     responses:
 *       '200':
 *         description: IPFS service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 data:
 *                   type: object
 *                   properties:
 *                     ipfs:
 *                       type: object
 *                       properties:
 *                         connected:
 *                           type: boolean
 *                           example: true
 *                         version:
 *                           type: string
 *                           example: 0.22.0
 *       '503':
 *         description: IPFS service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/transactions:
 *   get:
 *     tags: [Transactions]
 *     summary: List queued transactions
 *     description: Returns a paginated list of transactions in the queue with optional status filtering.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         description: Filter by status
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       '200':
 *         description: Transactions retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     tags: [Transactions]
 *     summary: Queue a new Stellar transaction
 *     description: Submits a new transaction to the queue for asynchronous processing.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sourceAccount, destinationAccount, amount]
 *             properties:
 *               sourceAccount:
 *                 type: string
 *                 description: Stellar source account public key
 *                 example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA
 *               destinationAccount:
 *                 type: string
 *                 description: Stellar destination account public key
 *                 example: GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP
 *               amount:
 *                 type: string
 *                 description: Amount to send
 *                 example: "10.5"
 *               asset:
 *                 type: object
 *                 description: Asset (defaults to XLM)
 *                 nullable: true
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *     responses:
 *       '201':
 *         description: Transaction queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Transaction'
 *       '400':
 *         description: Invalid transaction parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Queue submission error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/transactions/{transactionId}:
 *   get:
 *     tags: [Transactions]
 *     summary: Get transaction by ID
 *     description: Retrieves a single transaction's details including its queue status.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         example: txn_01HXZ9QABC777001
 *     responses:
 *       '200':
 *         description: Transaction retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Transaction'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// ─── Credentials ──────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/credentials/issue:
 *   post:
 *     tags: [Authentication]
 *     summary: Issue a credential on-chain
 *     description: Issues a tamper-proof educational credential on the Stellar blockchain.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IssueCredentialRequest'
 *     responses:
 *       '201':
 *         description: Credential issued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Credential'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Blockchain submission error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/credentials/{id}:
 *   get:
 *     tags: [Authentication]
 *     summary: Verify a credential by ID
 *     description: Retrieves and verifies a credential's on-chain status. Public endpoint.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: cred_01HXZ9QABC111001
 *     responses:
 *       '200':
 *         description: Credential verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Credential'
 *                 verified:
 *                   type: boolean
 *                   example: true
 *       '404':
 *         description: Credential not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Verification error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/credentials/user/{address}:
 *   get:
 *     tags: [Authentication]
 *     summary: Get credentials for a user
 *     description: Returns all credentials earned by a given Stellar wallet address.
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA
 *     responses:
 *       '200':
 *         description: Credentials retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Credential'
 *       '404':
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// ─── Holographic ──────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/holographic/encode:
 *   post:
 *     tags: [Holographic]
 *     summary: Encode content in holographic format
 *     description: >
 *       Encodes binary content using wavelet-based 3D spatial interference
 *       patterns, achieving 2–3× compression and enabling parallel read speeds
 *       up to 15,000 MB/s.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HolographicEncodeRequest'
 *     responses:
 *       '200':
 *         description: Content encoded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HolographicEncodeResponse'
 *       '400':
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Encoding error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/holographic/decode/{hash}:
 *   get:
 *     tags: [Holographic]
 *     summary: Decode holographic content
 *     description: Reconstructs original binary data from a holographic hash.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hash
 *         required: true
 *         schema:
 *           type: string
 *         description: Holographic content hash returned by /encode
 *         example: holo_a1b2c3d4e5f6
 *     responses:
 *       '200':
 *         description: Content decoded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 contentId:
 *                   type: string
 *                   example: course-101
 *                 data:
 *                   type: string
 *                   format: byte
 *                   description: Base64-encoded decoded content
 *       '404':
 *         description: Hash not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Decoding error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/holographic/access/parallel:
 *   post:
 *     tags: [Holographic]
 *     summary: Parallel access to multiple holographic objects
 *     description: Retrieves multiple holographic content items simultaneously for high-speed delivery.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hashes]
 *             properties:
 *               hashes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["holo_a1b2c3", "holo_d4e5f6"]
 *     responses:
 *       '200':
 *         description: Parallel access results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       hash:
 *                         type: string
 *                       data:
 *                         type: string
 *                         format: byte
 *       '400':
 *         description: Invalid hashes list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/holographic/metrics:
 *   get:
 *     tags: [Holographic]
 *     summary: Get holographic storage metrics
 *     description: Returns performance statistics including density, throughput, and total stored objects.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Metrics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/HolographicMetrics'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/holographic/optimize:
 *   post:
 *     tags: [Holographic]
 *     summary: Optimize holographic storage density
 *     description: Runs the storage optimizer to compact fragmented holographic data and improve density.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Optimization completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 densityBefore:
 *                   type: number
 *                   format: float
 *                   example: 0.72
 *                 densityAfter:
 *                   type: number
 *                   format: float
 *                   example: 0.88
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Optimization error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * Export marker to satisfy TypeScript module requirements
 */
export {};

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get user notifications
 *     description: Returns paginated notifications for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: read
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       '200':
 *         description: Notifications retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a notification as read
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: notif_01HXZ9QABC555001
 *     responses:
 *       '200':
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 updated:
 *                   type: integer
 *                   example: 5
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// ─── Gamification ─────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/gamification/leaderboard:
 *   get:
 *     tags: [Gamification]
 *     summary: Get the global leaderboard
 *     description: Returns the top-ranked users sorted by points.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [all-time, monthly, weekly]
 *           default: all-time
 *     responses:
 *       '200':
 *         description: Leaderboard retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeaderboardEntry'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/gamification/user/{userId}/achievements:
 *   get:
 *     tags: [Gamification]
 *     summary: Get achievements for a user
 *     description: Returns all badges and achievements earned by the specified user.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         example: usr_01HXZ9QABC123456
 *     responses:
 *       '200':
 *         description: Achievements retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Achievement'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/gamification/event:
 *   post:
 *     tags: [Gamification]
 *     summary: Process a gamification event
 *     description: Triggers point/badge evaluation for a user action (e.g., lesson complete, quiz pass).
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, event]
 *             properties:
 *               userId:
 *                 type: string
 *                 example: usr_01HXZ9QABC123456
 *               event:
 *                 type: string
 *                 enum: [lesson_complete, quiz_pass, course_complete, first_login, streak_7]
 *                 example: lesson_complete
 *               data:
 *                 type: object
 *                 nullable: true
 *                 example: { courseId: "course_01HXZ9QABC123456" }
 *     responses:
 *       '200':
 *         description: Event processed, points/badges awarded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 pointsAwarded:
 *                   type: integer
 *                   example: 50
 *                 newAchievements:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Achievement'
 *       '400':
 *         description: Invalid event type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/analytics/event:
 *   post:
 *     tags: [Analytics]
 *     summary: Track an analytics event
 *     description: Records a user interaction event for platform analytics.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnalyticsEvent'
 *     responses:
 *       '201':
 *         description: Event recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       '400':
 *         description: Invalid event payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/analytics/dashboard:
 *   get:
 *     tags: [Analytics]
 *     summary: Get platform analytics dashboard
 *     description: Returns aggregated platform metrics for the admin dashboard.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *         example: "2024-01-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *         example: "2024-12-31"
 *     responses:
 *       '200':
 *         description: Analytics data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                       example: 12500
 *                     activeUsers:
 *                       type: integer
 *                       example: 3800
 *                     totalEnrollments:
 *                       type: integer
 *                       example: 45000
 *                     completionRate:
 *                       type: number
 *                       format: float
 *                       example: 0.68
 *                     revenue:
 *                       type: number
 *                       format: float
 *                       example: 125000.00
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// ─── Quizzes ──────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/quizzes:
 *   get:
 *     tags: [Quizzes]
 *     summary: List quizzes
 *     description: Returns a paginated list of quizzes, optionally filtered by courseId.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *         description: Filter by course
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       '200':
 *         description: Quizzes retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Quiz'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     tags: [Quizzes]
 *     summary: Create a new quiz
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, courseId, questions]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Blockchain Basics Quiz
 *               courseId:
 *                 type: string
 *                 example: course_01HXZ9QABC123456
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                     options:
 *                       type: array
 *                       items:
 *                         type: string
 *                     correctAnswer:
 *                       type: string
 *               timeLimit:
 *                 type: integer
 *                 description: Time limit in minutes
 *                 example: 30
 *     responses:
 *       '201':
 *         description: Quiz created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Quiz'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/quizzes/{id}:
 *   get:
 *     tags: [Quizzes]
 *     summary: Get quiz by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: quiz_01HXZ9QABC666001
 *     responses:
 *       '200':
 *         description: Quiz retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Quiz'
 *       '404':
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/quizzes/{id}/submit:
 *   post:
 *     tags: [Quizzes]
 *     summary: Submit quiz answers
 *     description: Submits answers for a quiz attempt and returns the score and feedback.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: quiz_01HXZ9QABC666001
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 description: Array of selected answers indexed by question order
 *                 items:
 *                   type: string
 *                 example: ["A", "C", "B"]
 *               timeTaken:
 *                 type: integer
 *                 description: Time taken in seconds
 *                 example: 840
 *     responses:
 *       '200':
 *         description: Submission graded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 score:
 *                   type: number
 *                   format: float
 *                   example: 86.7
 *                 passed:
 *                   type: boolean
 *                   example: true
 *                 feedback:
 *                   type: array
 *                   items:
 *                     type: object
 *       '400':
 *         description: Invalid submission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// ─── Collaboration ────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/collaboration/rooms:
 *   get:
 *     tags: [Collaboration]
 *     summary: List collaboration rooms
 *     description: Returns active real-time collaboration rooms, optionally filtered by course.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *         description: Filter by course ID
 *     responses:
 *       '200':
 *         description: Rooms retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CollaborationRoom'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     tags: [Collaboration]
 *     summary: Create a collaboration room
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [courseId]
 *             properties:
 *               courseId:
 *                 type: string
 *                 example: course_01HXZ9QABC123456
 *               maxParticipants:
 *                 type: integer
 *                 default: 10
 *                 example: 5
 *     responses:
 *       '201':
 *         description: Room created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/CollaborationRoom'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/collaboration/rooms/{roomId}/join:
 *   post:
 *     tags: [Collaboration]
 *     summary: Join a collaboration room
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         example: room_01HXZ9QABC333001
 *     responses:
 *       '200':
 *         description: Joined room successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/CollaborationRoom'
 *       '400':
 *         description: Room is full
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/collaboration/rooms/{roomId}/leave:
 *   post:
 *     tags: [Collaboration]
 *     summary: Leave a collaboration room
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         example: room_01HXZ9QABC333001
 *     responses:
 *       '200':
 *         description: Left room successfully
 *       '404':
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

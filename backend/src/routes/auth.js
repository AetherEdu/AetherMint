const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin, requirePermission } = require('../middleware/auth');
const { UserRole, PERMISSIONS } = require('../utils/roles');
const { authLimiter } = require('../middleware/rateLimiter');
const securityService = require('../services/securityService');
const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Authentication
 *     description: User authentication and profile management
 */

// Mock user database - replace with actual database implementation
const users = new Map();

/**
 * Generate JWT token
 * @param {Object} user - User object
 * @returns {string} - JWT token
 */
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      email: user.email 
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );
}

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Create a new user account with username, email, and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: securePass123
 *               role:
 *                 type: string
 *                 enum: [student, educator, admin]
 *                 default: student
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 token:
 *                   type: string
 *       400:
 *         description: Missing required fields or invalid role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: User already exists
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password, role = UserRole.STUDENT } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Username, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUser = Array.from(users.values()).find(
      user => user.username === username || user.email === email
    );

    if (existingUser) {
      await securityService.logSecurityEvent(req.ip, 'auth_conflict', { username, email });
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        message: 'A user with this username or email already exists'
      });
    }

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'Role must be one of: student, educator, admin'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    users.set(newUser.id, newUser);

    // Generate token
    const token = generateToken(newUser);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error during user registration'
    });
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Authenticate user
 *     description: Login with username/email and password to get JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe
 *               password:
 *                 type: string
 *                 format: password
 *                 example: securePass123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                 token:
 *                   type: string
 *       400:
 *         description: Missing credentials
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Username and password are required'
      });
    }

    // Find user by username or email
    const user = Array.from(users.values()).find(
      u => u.username === username || u.email === username
    );

    if (!user) {
      await securityService.logSecurityEvent(req.ip, 'auth_failure', { username, reason: 'user_not_found' });
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid username or password'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await securityService.logSecurityEvent(req.ip, 'auth_failure', { username, reason: 'invalid_password' });
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid username or password'
      });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error during login'
    });
  }
});

/**
 * @openapi
 * /api/auth/profile:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: User not found
 *   put:
 *     tags: [Authentication]
 *     summary: Update user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 */
router.get('/profile', authenticateToken, (req, res) => {
  const user = users.get(req.user.id);
  
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: 'User profile not found'
    });
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  });
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword } = req.body;
    const user = users.get(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    // Check if changing password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          error: 'Current password required',
          message: 'Current password is required to change password'
        });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid current password',
          message: 'The current password provided is incorrect'
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    // Update other fields
    if (username && username !== user.username) {
      // Check if username is already taken
      const existingUser = Array.from(users.values()).find(
        u => u.username === username && u.id !== user.id
      );
      
      if (existingUser) {
        return res.status(409).json({
          error: 'Username taken',
          message: 'This username is already taken'
        });
      }
      
      user.username = username;
    }

    if (email && email !== user.email) {
      // Check if email is already taken
      const existingUser = Array.from(users.values()).find(
        u => u.email === email && u.id !== user.id
      );
      
      if (existingUser) {
        return res.status(409).json({
          error: 'Email taken',
          message: 'This email is already registered'
        });
      }
      
      user.email = email;
    }

    user.updatedAt = new Date().toISOString();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error updating profile'
    });
  }
});

/**
 * @openapi
 * /api/auth/assign-role/{userId}:
 *   put:
 *     tags: [Authentication]
 *     summary: Assign role to user (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [student, educator, admin]
 *     responses:
 *       200:
 *         description: Role assigned successfully
 *       400:
 *         description: Invalid role
 *       404:
 *         description: User not found
 */
router.put('/assign-role/:userId', 
  authenticateToken, 
  requireAdmin, 
  requirePermission(PERMISSIONS.USER_ASSIGN_ROLE),
  (req, res) => {
    try {
      const { role } = req.body;
      const { userId } = req.params;

      // Validate role
      if (!Object.values(UserRole).includes(role)) {
        return res.status(400).json({
          error: 'Invalid role',
          message: 'Role must be one of: student, educator, admin'
        });
      }

      const user = users.get(userId);
      
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User with the specified ID not found'
        });
      }

      const oldRole = user.role;
      user.role = role;
      user.updatedAt = new Date().toISOString();

      res.json({
        message: 'Role assigned successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          oldRole,
          newRole: user.role,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      console.error('Role assignment error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Error assigning role'
      });
    }
  }
);

/**
 * @openapi
 * /api/auth/users:
 *   get:
 *     tags: [Authentication]
 *     summary: Get all users (Admin only)
 *     security:
 *       - bearerAuth: []
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
 *           default: 10
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [student, educator, admin]
 *     responses:
 *       200:
 *         description: Users retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/users', 
  authenticateToken, 
  requireAdmin, 
  requirePermission(PERMISSIONS.USER_READ),
  (req, res) => {
    try {
      const { page = 1, limit = 10, role } = req.query;
      const offset = (page - 1) * limit;

      let allUsers = Array.from(users.values());

      // Filter by role if specified
      if (role) {
        allUsers = allUsers.filter(user => user.role === role);
      }

      // Remove password from response
      const usersWithoutPassword = allUsers.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));

      // Pagination
      const paginatedUsers = usersWithoutPassword.slice(offset, offset + parseInt(limit));

      res.json({
        users: paginatedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: usersWithoutPassword.length,
          pages: Math.ceil(usersWithoutPassword.length / limit)
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Error retrieving users'
      });
    }
  }
);

/**
 * @openapi
 * /api/auth/users/{userId}:
 *   delete:
 *     tags: [Authentication]
 *     summary: Delete user (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: Cannot delete self
 *       404:
 *         description: User not found
 */
router.delete('/users/:userId', 
  authenticateToken, 
  requireAdmin, 
  requirePermission(PERMISSIONS.USER_DELETE),
  (req, res) => {
    try {
      const { userId } = req.params;
      const user = users.get(userId);

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User with the specified ID not found'
        });
      }

      // Prevent admin from deleting themselves
      if (userId === req.user.id) {
        return res.status(400).json({
          error: 'Cannot delete self',
          message: 'Administrators cannot delete their own accounts'
        });
      }

      users.delete(userId);

      res.json({
        message: 'User deleted successfully',
        deletedUser: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Error deleting user'
      });
    }
  }
);

module.exports = router;

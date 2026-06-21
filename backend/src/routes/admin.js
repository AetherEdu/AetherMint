const express = require('express');
const { authenticateToken, requireAdmin, requirePermission } = require('../middleware/auth');
const { PERMISSIONS, UserRole } = require('../utils/roles');
const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * Get admin dashboard statistics
 * GET /api/admin/dashboard
 */
router.get('/dashboard', requirePermission(PERMISSIONS.ADMIN_PANEL), (req, res) => {
  try {
    // Mock statistics - replace with actual database queries
    const stats = {
      users: {
        total: 1250,
        students: 1000,
        educators: 200,
        admins: 50,
        newThisMonth: 75
      },
      courses: {
        total: 150,
        published: 120,
        draft: 30,
        newThisMonth: 12
      },
      quizzes: {
        total: 450,
        active: 380,
        completed: 2500,
        averageScore: 78.5
      },
      system: {
        uptime: '99.9%',
        storage: '45.2 GB used / 100 GB',
        lastBackup: new Date().toISOString(),
        activeConnections: 234
      }
    };

    res.json({
      message: 'Dashboard statistics retrieved successfully',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error retrieving dashboard statistics'
    });
  }
});

/**
 * Get system logs (Admin only)
 * GET /api/admin/logs
 */
router.get('/logs', requirePermission(PERMISSIONS.SYSTEM_MANAGE), (req, res) => {
  try {
    const { 
      level = 'info', 
      page = 1, 
      limit = 50, 
      startDate, 
      endDate 
    } = req.query;

    // Mock logs - replace with actual log retrieval system
    const logs = [
      {
        id: 1,
        level: 'info',
        message: 'User login successful',
        userId: '123',
        timestamp: new Date().toISOString(),
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0...'
      },
      {
        id: 2,
        level: 'warning',
        message: 'Failed login attempt',
        userId: null,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0...'
      },
      {
        id: 3,
        level: 'error',
        message: 'Database connection failed',
        userId: null,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        ip: '127.0.0.1',
        userAgent: 'Internal'
      }
    ];

    // Filter by level if specified
    const filteredLogs = level === 'all' ? logs : logs.filter(log => log.level === level);

    // Pagination
    const offset = (page - 1) * limit;
    const paginatedLogs = filteredLogs.slice(offset, offset + parseInt(limit));

    res.json({
      logs: paginatedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredLogs.length,
        pages: Math.ceil(filteredLogs.length / limit)
      },
      filters: {
        level,
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Logs retrieval error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error retrieving system logs'
    });
  }
});

/**
 * Get user activity report (Admin only)
 * GET /api/admin/reports/user-activity
 */
router.get('/reports/user-activity', requirePermission(PERMISSIONS.USER_READ), (req, res) => {
  try {
    const { period = '30d', role } = req.query;

    // Mock activity data - replace with actual analytics
    const activityData = {
      period,
      totalUsers: 1250,
      activeUsers: 890,
      newUsers: 75,
      userRetention: {
        day1: 95,
        day7: 82,
        day30: 68,
        day90: 45
      },
      roleDistribution: {
        students: 1000,
        educators: 200,
        admins: 50
      },
      dailyActivity: [
        { date: '2024-01-01', logins: 245, signups: 12, courseCompletions: 8 },
        { date: '2024-01-02', logins: 289, signups: 15, courseCompletions: 12 },
        { date: '2024-01-03', logins: 312, signups: 8, courseCompletions: 15 }
      ]
    };

    res.json({
      message: 'User activity report generated successfully',
      data: activityData,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Activity report error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error generating activity report'
    });
  }
});

/**
 * Get course performance report (Admin only)
 * GET /api/admin/reports/course-performance
 */
router.get('/reports/course-performance', requirePermission(PERMISSIONS.COURSE_READ), (req, res) => {
  try {
    const { period = '30d', courseId } = req.query;

    // Mock course performance data
    const performanceData = {
      period,
      totalCourses: 150,
      averageCompletion: 72.5,
      totalEnrollments: 5432,
      averageRating: 4.3,
      topCourses: [
        {
          id: '1',
          title: 'Introduction to Blockchain',
          enrollments: 450,
          completions: 380,
          averageRating: 4.7,
          completionRate: 84.4
        },
        {
          id: '2',
          title: 'Advanced Smart Contracts',
          enrollments: 320,
          completions: 245,
          averageRating: 4.5,
          completionRate: 76.6
        }
      ],
      categoryPerformance: [
        { category: 'Blockchain', courses: 45, enrollments: 2100, avgCompletion: 78.2 },
        { category: 'Programming', courses: 38, enrollments: 1800, avgCompletion: 71.5 },
        { category: 'Design', courses: 28, enrollments: 980, avgCompletion: 65.3 }
      ]
    };

    res.json({
      message: 'Course performance report generated successfully',
      data: performanceData,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Course performance report error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error generating course performance report'
    });
  }
});

/**
 * Manage system settings (Admin only)
 * GET /api/admin/settings
 */
router.get('/settings', requirePermission(PERMISSIONS.SYSTEM_MANAGE), (req, res) => {
  try {
    // Mock system settings - replace with actual configuration management
    const settings = {
      general: {
        siteName: 'AetherMint Education Platform',
        siteDescription: 'Decentralized education on Stellar',
        maintenanceMode: false,
        registrationEnabled: true,
        emailVerificationRequired: true
      },
      security: {
        passwordMinLength: 8,
        sessionTimeout: 24,
        maxLoginAttempts: 5,
        lockoutDuration: 15
      },
      features: {
        coursesEnabled: true,
        quizzesEnabled: true,
        certificatesEnabled: true,
        socialFeaturesEnabled: true
      },
      limits: {
        maxCoursesPerUser: 10,
        maxQuizzesPerCourse: 50,
        maxFileSize: 10485760, // 10MB
        maxUsersPerPlan: 1000
      }
    };

    res.json({
      message: 'System settings retrieved successfully',
      settings
    });
  } catch (error) {
    console.error('Settings retrieval error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error retrieving system settings'
    });
  }
});

/**
 * Update system settings (Admin only)
 * PUT /api/admin/settings
 */
router.put('/settings', requirePermission(PERMISSIONS.SYSTEM_MANAGE), (req, res) => {
  try {
    const { category, settings } = req.body;

    if (!category || !settings) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Category and settings are required'
      });
    }

    // Mock settings update - replace with actual configuration update
    const validCategories = ['general', 'security', 'features', 'limits'];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: 'Invalid category',
        message: `Category must be one of: ${validCategories.join(', ')}`
      });
    }

    // In a real implementation, you would validate and update the settings in your database
    // or configuration file

    res.json({
      message: 'System settings updated successfully',
      category,
      settings,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error updating system settings'
    });
  }
});

/**
 * Backup system data (Admin only)
 * POST /api/admin/backup
 */
router.post('/backup', requirePermission(PERMISSIONS.SYSTEM_MANAGE), (req, res) => {
  try {
    const { type = 'full', includeFiles = true } = req.body;

    // Mock backup process - replace with actual backup implementation
    const backupId = `backup_${Date.now()}`;
    const backupSize = Math.floor(Math.random() * 1000000000); // Random size in bytes

    // In a real implementation, you would:
    // 1. Create database backup
    // 2. Backup file storage if includeFiles is true
    // 3. Compress and store the backup
    // 4. Return download link or backup information

    res.json({
      message: 'Backup initiated successfully',
      backup: {
        id: backupId,
        type,
        size: backupSize,
        includeFiles,
        status: 'in_progress',
        estimatedCompletion: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
        downloadUrl: `/api/admin/backups/${backupId}/download`
      }
    });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error initiating backup'
    });
  }
});

/**
 * Get list of backups (Admin only)
 * GET /api/admin/backups
 */
router.get('/backups', requirePermission(PERMISSIONS.SYSTEM_MANAGE), (req, res) => {
  try {
    // Mock backup list - replace with actual backup storage retrieval
    const backups = [
      {
        id: 'backup_1704067200000',
        type: 'full',
        size: 1048576000,
        status: 'completed',
        createdAt: '2024-01-01T00:00:00.000Z',
        downloadUrl: '/api/admin/backups/backup_1704067200000/download'
      },
      {
        id: 'backup_1703980800000',
        type: 'incremental',
        size: 524288000,
        status: 'completed',
        createdAt: '2023-12-31T00:00:00.000Z',
        downloadUrl: '/api/admin/backups/backup_1703980800000/download'
      }
    ];

    res.json({
      message: 'Backups retrieved successfully',
      backups,
      total: backups.length
    });
  } catch (error) {
    console.error('Backups retrieval error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error retrieving backups'
    });
  }
});

/**
 * Send system announcement (Admin only)
 * POST /api/admin/announcements
 */
router.post('/announcements', requirePermission(PERMISSIONS.SYSTEM_MANAGE), (req, res) => {
  try {
    const { title, message, targetRoles = [], priority = 'normal', expiresAt } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Title and message are required'
      });
    }

    // Validate priority
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        error: 'Invalid priority',
        message: `Priority must be one of: ${validPriorities.join(', ')}`
      });
    }

    // Validate target roles
    if (targetRoles.length > 0) {
      const invalidRoles = targetRoles.filter(role => !Object.values(UserRole).includes(role));
      if (invalidRoles.length > 0) {
        return res.status(400).json({
          error: 'Invalid roles',
          message: `Invalid target roles: ${invalidRoles.join(', ')}`
        });
      }
    }

    // Mock announcement creation
    const announcement = {
      id: `announcement_${Date.now()}`,
      title,
      message,
      targetRoles,
      priority,
      expiresAt,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      active: true
    };

    // In a real implementation, you would:
    // 1. Store the announcement in the database
    // 2. Send notifications to targeted users
    // 3. Display the announcement on the platform

    res.status(201).json({
      message: 'Announcement created successfully',
      announcement
    });
  } catch (error) {
    console.error('Announcement creation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error creating announcement'
    });
  }
});

module.exports = router;

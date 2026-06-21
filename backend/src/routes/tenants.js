const express = require('express');
const tenantService = require('../services/tenantService');
const { tenantMiddleware, checkResourceLimits, requireTenantPermission } = require('../middleware/tenant');
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const createTenantSchema = Joi.object({
  name: Joi.string().required().min(2).max(100),
  subdomain: Joi.string().required().min(3).max(50).pattern(/^[a-z0-9-]+$/),
  domain: Joi.string().optional(),
  plan: Joi.string().valid('starter', 'professional', 'enterprise').default('starter'),
  branding: Joi.object({
    logo: Joi.string().optional(),
    primaryColor: Joi.string().optional(),
    secondaryColor: Joi.string().optional(),
    theme: Joi.string().valid('light', 'dark', 'auto').optional(),
    customCSS: Joi.string().optional(),
    favicon: Joi.string().optional(),
    companyName: Joi.string().optional(),
    supportEmail: Joi.string().email().optional()
  }).optional(),
  settings: Joi.object({
    allowPublicRegistration: Joi.boolean().optional(),
    requireEmailVerification: Joi.boolean().optional(),
    enableSSO: Joi.boolean().optional(),
    ssoProvider: Joi.string().optional(),
    defaultLanguage: Joi.string().optional(),
    timezone: Joi.string().optional(),
    maxUsers: Joi.number().integer().min(1).optional(),
    maxStorage: Joi.number().integer().min(1).optional()
  }).optional(),
  contact: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().optional(),
    address: Joi.object({
      street: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      country: Joi.string().optional(),
      zipCode: Joi.string().optional()
    }).optional()
  }).required(),
  adminUser: Joi.object({
    profile: Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().optional()
    }).required(),
    auth: Joi.object({
      password: Joi.string().min(8).required()
    }).required()
  }).required()
});

const createTenantUserSchema = Joi.object({
  profile: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().optional(),
    bio: Joi.string().optional(),
    timezone: Joi.string().optional(),
    language: Joi.string().optional()
  }).required(),
  stellar: Joi.object({
    publicKey: Joi.string().required().pattern(/^G[0-9A-Z]{55}$/),
    secretKey: Joi.string().optional()
  }).required(),
  roles: Joi.array().items(Joi.string().valid('super_admin', 'tenant_admin', 'instructor', 'student', 'ta')).default(['student']),
  permissions: Joi.array().items(Joi.object({
    resource: Joi.string().required(),
    actions: Joi.array().items(Joi.string()).required()
  })).optional(),
  academic: Joi.object({
    studentId: Joi.string().optional(),
    grade: Joi.string().optional(),
    department: Joi.string().optional(),
    major: Joi.string().optional(),
    enrollmentDate: Joi.date().optional(),
    graduationDate: Joi.date().optional()
  }).optional()
});

const updateTenantSettingsSchema = Joi.object({
  allowPublicRegistration: Joi.boolean().optional(),
  requireEmailVerification: Joi.boolean().optional(),
  enableSSO: Joi.boolean().optional(),
  ssoProvider: Joi.string().optional(),
  defaultLanguage: Joi.string().optional(),
  timezone: Joi.string().optional(),
  maxUsers: Joi.number().integer().min(1).optional(),
  maxStorage: Joi.number().integer().min(1).optional()
});

const updateTenantBrandingSchema = Joi.object({
  logo: Joi.string().optional(),
  primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  theme: Joi.string().valid('light', 'dark', 'auto').optional(),
  customCSS: Joi.string().optional(),
  favicon: Joi.string().optional(),
  companyName: Joi.string().optional(),
  supportEmail: Joi.string().email().optional()
});

// Public routes

/**
 * POST /api/tenants
 * Create a new tenant (public endpoint for self-service signup)
 */
router.post('/', async (req, res) => {
  try {
    const { error, value } = createTenantSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const result = await tenantService.createTenant(
      {
        name: value.name,
        subdomain: value.subdomain,
        domain: value.domain,
        plan: value.plan,
        branding: value.branding,
        settings: value.settings,
        contact: value.contact
      },
      value.adminUser
    );

    res.status(201).json({
      success: true,
      message: result.message,
      data: {
        tenant: {
          id: result.tenant._id,
          name: result.tenant.name,
          subdomain: result.tenant.subdomain,
          status: result.tenant.status,
          plan: result.tenant.plan
        },
        adminUser: {
          id: result.adminUser._id,
          profile: result.adminUser.profile,
          roles: result.adminUser.roles
        }
      }
    });
  } catch (error) {
    console.error('Create tenant error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/tenants/:domain
 * Get tenant by domain or subdomain (public endpoint for tenant discovery)
 */
router.get('/:domain', async (req, res) => {
  try {
    const tenant = await tenantService.getTenantByDomain(req.params.domain);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Return only public information
    res.json({
      success: true,
      data: {
        id: tenant._id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        branding: {
          logo: tenant.branding.logo,
          primaryColor: tenant.branding.primaryColor,
          secondaryColor: tenant.branding.secondaryColor,
          theme: tenant.branding.theme,
          companyName: tenant.branding.companyName
        },
        settings: {
          allowPublicRegistration: tenant.settings.allowPublicRegistration,
          requireEmailVerification: tenant.settings.requireEmailVerification,
          defaultLanguage: tenant.settings.defaultLanguage
        }
      }
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Tenant-protected routes

/**
 * POST /api/tenants/:tenantId/users
 * Create user within tenant
 */
router.post('/:tenantId/users', 
  tenantMiddleware,
  checkResourceLimits('users'),
  requireTenantPermission('users', 'create'),
  async (req, res) => {
    try {
      const { error, value } = createTenantUserSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      const user = await tenantService.createTenantUser(req.tenantId, value);

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: user
      });
    } catch (error) {
      console.error('Create tenant user error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * GET /api/tenants/:tenantId/users
 * Get tenant users with pagination and filtering
 */
router.get('/:tenantId/users',
  tenantMiddleware,
  requireTenantPermission('users', 'read'),
  async (req, res) => {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        search: req.query.search,
        role: req.query.role,
        status: req.query.status,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };

      const result = await tenantService.getTenantUsers(req.tenantId, options);

      res.json({
        success: true,
        data: result.users,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get tenant users error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/tenants/:tenantId/settings
 * Update tenant settings
 */
router.put('/:tenantId/settings',
  tenantMiddleware,
  requireTenantPermission('settings', 'update'),
  async (req, res) => {
    try {
      const { error, value } = updateTenantSettingsSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      const tenant = await tenantService.updateTenantSettings(req.tenantId, value);

      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: tenant.settings
      });
    } catch (error) {
      console.error('Update tenant settings error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/tenants/:tenantId/branding
 * Update tenant branding
 */
router.put('/:tenantId/branding',
  tenantMiddleware,
  requireTenantPermission('branding', 'update'),
  async (req, res) => {
    try {
      const { error, value } = updateTenantBrandingSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      const tenant = await tenantService.updateTenantBranding(req.tenantId, value);

      res.json({
        success: true,
        message: 'Branding updated successfully',
        data: tenant.branding
      });
    } catch (error) {
      console.error('Update tenant branding error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * GET /api/tenants/:tenantId/usage
 * Get tenant usage statistics
 */
router.get('/:tenantId/usage',
  tenantMiddleware,
  requireTenantPermission('analytics', 'read'),
  async (req, res) => {
    try {
      const usage = await tenantService.getTenantUsage(req.tenantId);

      res.json({
        success: true,
        data: usage
      });
    } catch (error) {
      console.error('Get tenant usage error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/tenants/:tenantId/status
 * Update tenant status (admin only)
 */
router.put('/:tenantId/status',
  tenantMiddleware,
  requireTenantPermission('admin', 'manage'),
  async (req, res) => {
    try {
      const { status } = req.body;
      
      if (!['active', 'inactive', 'suspended', 'trial'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }

      const tenant = await tenantService.updateTenantStatus(req.tenantId, status);

      res.json({
        success: true,
        message: 'Tenant status updated successfully',
        data: {
          id: tenant._id,
          status: tenant.status
        }
      });
    } catch (error) {
      console.error('Update tenant status error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/tenants/:tenantId
 * Delete tenant (admin only)
 */
router.delete('/:tenantId',
  tenantMiddleware,
  requireTenantPermission('admin', 'delete'),
  async (req, res) => {
    try {
      const result = await tenantService.deleteTenant(req.tenantId);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Delete tenant error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

module.exports = router;

const Tenant = require('../models/Tenant');
const TenantUser = require('../models/TenantUser');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  AuthError,
  RateLimitError,
  InternalError,
} = require('../utils/errors');

/**
 * Multi-tenant middleware to identify and validate tenant from request
 */
const tenantMiddleware = async (req, res, next) => {
  try {
    // Extract tenant information from request
    const tenantInfo = extractTenantInfo(req);

    if (!tenantInfo) {
      return next(new ValidationError('Tenant information required'));
    }

    // Find tenant
    const tenant = await Tenant.findOne({
      $or: [
        { subdomain: tenantInfo.subdomain },
        { domain: tenantInfo.domain }
      ]
    });

    if (!tenant) {
      return next(new NotFoundError('Tenant not found'));
    }

    // Check if tenant is active
    if (!tenant.isActive) {
      return next(new ForbiddenError('Tenant account is inactive or expired'));
    }

    // Attach tenant to request
    req.tenant = tenant;
    req.tenantId = tenant._id;

    // Add tenant context to response headers for debugging
    res.set('X-Tenant-ID', tenant._id.toString());
    res.set('X-Tenant-Name', tenant.name);
    res.set('X-Tenant-Subdomain', tenant.subdomain);

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    return next(new InternalError('Tenant middleware failed'));
  }
};

/**
 * Extract tenant information from various sources
 */
function extractTenantInfo(req) {
  // Method 1: Subdomain from hostname
  if (req.hostname) {
    const parts = req.hostname.toLowerCase().split('.');
    if (parts.length > 2) {
      const subdomain = parts[0];
      if (subdomain !== 'www' && subdomain !== 'api') {
        return { subdomain };
      }
    }
  }
  
  // Method 2: Custom header
  const tenantHeader = req.headers['x-tenant-id'];
  if (tenantHeader) {
    return { subdomain: tenantHeader };
  }
  
  // Method 3: Query parameter (for API testing)
  const tenantQuery = req.query.tenant;
  if (tenantQuery) {
    return { subdomain: tenantQuery };
  }
  
  // Method 4: Full domain mapping
  const domain = req.hostname;
  if (domain && domain !== 'localhost' && !domain.includes('127.0.0.1')) {
    return { domain };
  }
  
  return null;
}

/**
 * Middleware to check tenant resource limits
 */
const checkResourceLimits = (resource) => {
  return async (req, res, next) => {
    try {
      if (!req.tenant) {
        return next(new ValidationError('Tenant context required'));
      }

      const tenant = req.tenant;

      switch (resource) {
        case 'users':
          if (!tenant.canAddUser()) {
            const err = new RateLimitError('User limit exceeded for current plan');
            err.details = { quota: 'users' };
            return next(err);
          }
          break;

        case 'storage': {
          const additionalStorage = parseInt(req.body.storageSize) || 0;
          if (!tenant.canAllocateStorage(additionalStorage)) {
            const err = new RateLimitError('Storage limit exceeded for current plan');
            err.details = { quota: 'storage' };
            return next(err);
          }
          break;
        }

        case 'api':
          // This would typically be handled by rate limiting middleware
          // but we can add tenant-specific API call tracking here
          await tenant.incrementUsage('apiCalls');
          break;
      }

      next();
    } catch (error) {
      console.error('Resource limit check error:', error);
      return next(new InternalError('Resource limit check failed'));
    }
  };
};

/**
 * Middleware to ensure user belongs to current tenant
 */
const ensureTenantUser = async (req, res, next) => {
  try {
    if (!req.user || !req.tenant) {
      return next(new AuthError('Authentication and tenant context required'));
    }

    // Check if user belongs to current tenant
    const userTenant = await TenantUser.findOne({
      _id: req.user._id,
      tenantId: req.tenantId
    });

    if (!userTenant) {
      return next(new ForbiddenError('User does not belong to this tenant'));
    }

    // Attach tenant user to request
    req.tenantUser = userTenant;
    next();
  } catch (error) {
    console.error('Tenant user check error:', error);
    return next(new InternalError('Tenant user check failed'));
  }
};

/**
 * Middleware to check user permissions within tenant context
 */
const requireTenantPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      if (!req.tenantUser) {
        return next(new AuthError('Tenant user context required'));
      }

      // Super admins have access to everything
      if (req.tenantUser.hasRole('super_admin')) {
        return next();
      }

      // Tenant admins have most permissions within their tenant
      if (req.tenantUser.hasRole('tenant_admin')) {
        return next();
      }

      // Check specific permission
      if (!req.tenantUser.hasPermission(resource, action)) {
        const err = new ForbiddenError('Insufficient permissions');
        err.details = { required: { resource, action } };
        return next(err);
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return next(new InternalError('Permission check failed'));
    }
  };
};

/**
 * Middleware to add tenant isolation to database queries
 */
const tenantIsolation = (Model) => {
  return async (req, res, next) => {
    try {
      // Add tenant filter to query
      if (req.tenantId && Model.schema.paths.tenantId) {
        req.queryTenant = { tenantId: req.tenantId };
      }
      next();
    } catch (error) {
      console.error('Tenant isolation error:', error);
      return next(new InternalError('Tenant isolation failed'));
    }
  };
};

module.exports = {
  tenantMiddleware,
  checkResourceLimits,
  ensureTenantUser,
  requireTenantPermission,
  tenantIsolation
};

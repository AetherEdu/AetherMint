import { UserRole } from '../models/User';
export { UserRole };

// Role hierarchy for permission checking
export const ROLE_HIERARCHY: Record<string, number> = {
  [UserRole.STUDENT]: 1,
  [UserRole.INSTRUCTOR]: 2,
  [UserRole.MODERATOR]: 3,
  [UserRole.ADMIN]: 4
};

// Permission constants
export const PERMISSIONS = {
  // Course permissions
  COURSE_CREATE: 'course:create',
  COURSE_READ: 'course:read',
  COURSE_UPDATE: 'course:update',
  COURSE_DELETE: 'course:delete',
  COURSE_ENROLL: 'course:enroll',
  COURSE_GRADE: 'course:grade',
  
  // Progress permissions
  PROGRESS_TRACK: 'progress:track',
  CERTIFICATE_VIEW: 'certificate:view',
  
  // Quiz permissions
  QUIZ_CREATE: 'quiz:create',
  QUIZ_READ: 'quiz:read',
  QUIZ_UPDATE: 'quiz:update',
  QUIZ_DELETE: 'quiz:delete',
  
  // User profile permissions
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_ASSIGN_ROLE: 'user:assign_role',
  
  // Content moderation permissions
  MODERATION_CONTENT: 'moderation:content',
  MODERATION_USERS: 'moderation:users',
  MODERATION_DISPUTE: 'moderation:dispute',
  
  // Analytics and reporting permissions
  ANALYTICS_READ: 'analytics:read',
  REPORT_GENERATE: 'report:generate',
  
  // System administration permissions
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_MANAGE: 'system:manage',
  
  // Financial transaction permissions
  TRANSACTION_READ: 'transaction:read',
  TRANSACTION_MANAGE: 'transaction:manage',
  
  // Content permissions
  CONTENT_CREATE: 'content:create',
  CONTENT_READ: 'content:read',
  CONTENT_UPDATE: 'content:update',
  CONTENT_DELETE: 'content:delete'
};

// Role permissions mapping
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [UserRole.STUDENT]: [
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.COURSE_ENROLL,
    PERMISSIONS.PROGRESS_TRACK,
    PERMISSIONS.CERTIFICATE_VIEW,
    PERMISSIONS.QUIZ_READ,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.USER_READ
  ],
  
  [UserRole.INSTRUCTOR]: [
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_ENROLL,
    PERMISSIONS.COURSE_GRADE,
    PERMISSIONS.PROGRESS_TRACK,
    PERMISSIONS.CERTIFICATE_VIEW,
    PERMISSIONS.QUIZ_CREATE,
    PERMISSIONS.QUIZ_READ,
    PERMISSIONS.QUIZ_UPDATE,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_UPDATE,
    PERMISSIONS.USER_READ
  ],
  
  [UserRole.MODERATOR]: [
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.QUIZ_READ,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.MODERATION_CONTENT,
    PERMISSIONS.MODERATION_USERS,
    PERMISSIONS.MODERATION_DISPUTE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.ANALYTICS_READ
  ],
  
  [UserRole.ADMIN]: [
    // Admin has all permissions
    ...Object.values(PERMISSIONS)
  ]
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Check if a user role has higher or equal hierarchy level
 */
export function hasRoleLevel(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if user can perform action on resource
 */
export function canPerformAction(userRole: string, action: string, resource: string): boolean {
  const permission = `${resource}:${action}`;
  return hasPermission(userRole, permission);
}

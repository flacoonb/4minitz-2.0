import Settings from '@/models/Settings';

export interface UserPermissions {
  canCreateMeetings: boolean;
  canModerateAllMeetings: boolean;
  canViewAllMeetings: boolean;
  canViewAllMinutes: boolean;
  canEditAllMinutes: boolean;
  canDeleteMinutes: boolean;
  canManageUsers: boolean;
  canAssignModerators: boolean;
  canExportData: boolean;
  canAccessReports: boolean;
}

export interface User {
  _id: string | { toString(): string };
  role: 'admin' | 'moderator' | 'user';
  [key: string]: any;
}

// Role hierarchy for permission checking
const ROLE_HIERARCHY = {
  'admin': 3,
  'moderator': 2,
  'user': 1
} as const;

/**
 * Check if user has a specific role or higher
 */
export function hasRole(user: User, requiredRole: keyof typeof ROLE_HIERARCHY): boolean {
  const userLevel = ROLE_HIERARCHY[user.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Check if user has a specific permission based on system settings
 */
export async function hasPermission(
  user: User, 
  permission: keyof UserPermissions
): Promise<boolean> {
  try {
    // Get current system settings
    const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
    
    if (!settings) {
      // Fall back to default permissions if no settings exist
      return getDefaultPermissions(user.role)[permission] || false;
    }

    const rolePermissions = settings.roles[user.role];
    return rolePermissions ? rolePermissions[permission] || false : false;
  } catch (error) {
    console.error('Error checking permission:', error);
    // Fall back to default permissions on error
    return getDefaultPermissions(user.role)[permission] || false;
  }
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(user: User): Promise<UserPermissions> {
  try {
    const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
    
    if (!settings) {
      return getDefaultPermissions(user.role);
    }

    const rolePermissions = settings.roles[user.role];
    return rolePermissions || getDefaultPermissions(user.role);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return getDefaultPermissions(user.role);
  }
}

/**
 * Default permissions when no settings are available
 */
export function getDefaultPermissions(role: string): UserPermissions {
  const defaults = {
    admin: {
      canCreateMeetings: true,
      canModerateAllMeetings: true,
      canViewAllMeetings: true,
      canViewAllMinutes: true,
      canEditAllMinutes: true,
      canDeleteMinutes: true,
      canManageUsers: true,
      canAssignModerators: true,
      canExportData: true,
      canAccessReports: true
    },
    moderator: {
      canCreateMeetings: true,
      canModerateAllMeetings: false,
      canViewAllMeetings: true,
      canViewAllMinutes: false,
      canEditAllMinutes: false,
      canDeleteMinutes: false,
      canManageUsers: false,
      canAssignModerators: false,
      canExportData: true,
      canAccessReports: false
    },
    user: {
      canCreateMeetings: false,
      canModerateAllMeetings: false,
      canViewAllMeetings: false,
      canViewAllMinutes: false,
      canEditAllMinutes: false,
      canDeleteMinutes: false,
      canManageUsers: false,
      canAssignModerators: false,
      canExportData: false,
      canAccessReports: false
    }
  };

  return defaults[role as keyof typeof defaults] || defaults.user;
}

/**
 * Middleware helper for API route protection
 */
export async function requirePermission(
  user: { role: string; [key: string]: any },
  permission: keyof UserPermissions | string
): Promise<{ success: boolean; error?: string }> {
  try {
    const hasAccess = await hasPermission(
      user as User,
      permission as keyof UserPermissions
    );

    if (!hasAccess) {
      return {
        success: false,
        error: `Fehlende Berechtigung: ${permission}`
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      success: false,
      error: 'Fehler bei der Berechtigungsprüfung'
    };
  }
}

/**
 * Check if user owns a resource or has admin/moderator privileges
 */
export function canModifyResource(
  user: User, 
  resourceOwnerId: string, 
  requiredRole: keyof typeof ROLE_HIERARCHY = 'moderator'
): boolean {
  // User can modify their own resources
  if (user._id.toString() === resourceOwnerId) {
    return true;
  }
  
  // Or if they have sufficient role privileges
  return hasRole(user, requiredRole);
}

const permissions = {
  hasRole,
  hasPermission,
  getUserPermissions,
  requirePermission,
  canModifyResource,
};

export default permissions;
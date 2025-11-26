import Settings from '@/models/Settings';

export interface UserPermissions {
  canCreateMeetings: boolean;
  canModerateAllMeetings: boolean;
  canViewAllMeetings: boolean;
  canEditAllMinutes: boolean;
  canDeleteMinutes: boolean;
  canManageUsers: boolean;
  canAssignModerators: boolean;
  canExportData: boolean;
  canAccessReports: boolean;
}

export interface User {
  _id: string;
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
    const settings = await Settings.findOne({}).sort({ version: -1 });
    
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
    const settings = await Settings.findOne({}).sort({ version: -1 });
    
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
function getDefaultPermissions(role: string): UserPermissions {
  const defaults = {
    admin: {
      canCreateMeetings: true,
      canModerateAllMeetings: true,
      canViewAllMeetings: true,
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
 * Check if user can access a specific route
 */
export async function canAccessRoute(user: User | null, route: string): Promise<boolean> {
  if (!user) {
    // Public routes that don't require authentication
    const publicRoutes = ['/', '/auth/login', '/auth/register'];
    return publicRoutes.includes(route) || route.startsWith('/public');
  }

  // Define route permissions
  const routePermissions: Record<string, keyof UserPermissions | 'admin' | 'moderator' | null> = {
    '/admin/users': 'admin',
    '/admin/settings': 'admin',
    '/admin': 'admin',
    '/profile': null, // All authenticated users
    '/meeting-series': 'canViewAllMeetings',
    '/minutes': 'canViewAllMeetings',
    '/dashboard': null, // All authenticated users
  };

  // Check specific route permission
  for (const [routePath, permission] of Object.entries(routePermissions)) {
    if (route.startsWith(routePath)) {
      if (permission === null) {
        return true; // All authenticated users can access
      }
      
      if (permission === 'admin' || permission === 'moderator') {
        return hasRole(user, permission);
      }
      
      return await hasPermission(user, permission as keyof UserPermissions);
    }
  }

  // Default to allowing access if no specific rule is found
  return true;
}

/**
 * Middleware helper for API route protection
 */
export async function requirePermission(
  user: User, 
  permission: keyof UserPermissions
): Promise<{ success: boolean; error?: string }> {
  try {
    const hasAccess = await hasPermission(user, permission);
    
    if (!hasAccess) {
      return {
        success: false,
        error: 'Insufficient permissions for this action'
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      success: false,
      error: 'Error checking permissions'
    };
  }
}

/**
 * Check multiple permissions at once
 */
export async function hasAnyPermission(
  user: User, 
  permissions: (keyof UserPermissions)[]
): Promise<boolean> {
  try {
    const userPermissions = await getUserPermissions(user);
    return permissions.some(permission => userPermissions[permission]);
  } catch (error) {
    console.error('Error checking multiple permissions:', error);
    return false;
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

/**
 * Filter items based on user permissions
 */
export async function filterByPermissions<T extends { createdBy?: string; moderators?: string[] }>(
  user: User,
  items: T[],
  permission: keyof UserPermissions
): Promise<T[]> {
  const hasGlobalPermission = await hasPermission(user, permission);
  
  if (hasGlobalPermission) {
    return items; // User can see all items
  }

  // Filter to only items the user owns or moderates
  return items.filter(item => {
    if (item.createdBy && item.createdBy === user._id.toString()) {
      return true; // User created this item
    }
    
    if (item.moderators && item.moderators.includes(user._id.toString())) {
      return true; // User is a moderator of this item
    }
    
    return false;
  });
}

const permissions = {
  hasRole,
  hasPermission,
  getUserPermissions,
  canAccessRoute,
  requirePermission,
  hasAnyPermission,
  canModifyResource,
  filterByPermissions
};

export default permissions;
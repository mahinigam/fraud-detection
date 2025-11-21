import React from 'react'
import { motion } from 'framer-motion'
import { Shield, Lock, AlertTriangle, Home, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { auditLogger } from '../utils/auditLogger'
import { notifications } from '../utils/notifications'

export interface RouteProtectionConfig {
  requiredRoles?: string[]
  requiredPermissions?: string[]
  fallbackComponent?: React.ComponentType
  redirectTo?: string
  allowUnauthenticated?: boolean
}

// Enhanced Higher-Order Component for route protection
export function withRouteProtection<P extends object>(
  Component: React.ComponentType<P>,
  config: RouteProtectionConfig = {}
) {
  const {
    requiredRoles = [],
    requiredPermissions = [],
    fallbackComponent: FallbackComponent,
    allowUnauthenticated = false
  } = config

  return function ProtectedComponent(props: P) {
    const { user, userProfile, loading, hasRole, hasPermission } = useAuth()

    // Show loading state
    if (loading) {
      return <RouteLoadingState />
    }

    // Check authentication requirement
    if (!allowUnauthenticated && !user) {
      return <UnauthorizedAccess reason="authentication_required" />
    }

    // Check if user profile is loaded
    if (user && !userProfile) {
      return <RouteLoadingState message="Loading user profile..." />
    }

    // Check role requirements
    if (requiredRoles.length > 0 && userProfile && !hasRole(requiredRoles)) {
      // Log unauthorized access attempt
      auditLogger.logPermissionDenied('access_route', 'component', userProfile.role)
      notifications.permissionDenied('access this feature')
      
      return FallbackComponent ? (
        <FallbackComponent />
      ) : (
        <UnauthorizedAccess 
          reason="insufficient_role" 
          requiredRoles={requiredRoles}
          currentRole={userProfile.role}
        />
      )
    }

    // Check permission requirements
    if (requiredPermissions.length > 0 && userProfile) {
      const hasAllPermissions = requiredPermissions.every(permission => 
        hasPermission(permission)
      )
      
      if (!hasAllPermissions) {
        auditLogger.logPermissionDenied('access_route_permissions', 'component', userProfile.role)
        notifications.permissionDenied('access this feature')
        
        return FallbackComponent ? (
          <FallbackComponent />
        ) : (
          <UnauthorizedAccess 
            reason="insufficient_permissions" 
            requiredPermissions={requiredPermissions}
            currentRole={userProfile.role}
          />
        )
      }
    }

    // All checks passed, render the component
    return <Component {...props} />
  }
}

// Loading state component
function RouteLoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel p-8 text-center max-w-md"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full mx-auto mb-4"
        />
        <h3 className="text-xl font-semibold text-white mb-2">
          Fraud Detection System
        </h3>
        <p className="text-white/60">{message}</p>
      </motion.div>
    </div>
  )
}

// Unauthorized access component
interface UnauthorizedAccessProps {
  reason: 'authentication_required' | 'insufficient_role' | 'insufficient_permissions'
  requiredRoles?: string[]
  requiredPermissions?: string[]
  currentRole?: string
}

function UnauthorizedAccess({ 
  reason, 
  requiredRoles = [], 
  requiredPermissions = [],
  currentRole 
}: UnauthorizedAccessProps) {
  const getErrorContent = () => {
    switch (reason) {
      case 'authentication_required':
        return {
          icon: Lock,
          title: 'Authentication Required',
          message: 'You must be logged in to access this feature.',
          action: 'Please log in to continue',
          actionIcon: ArrowLeft,
          actionColor: 'blue'
        }
      
      case 'insufficient_role':
        return {
          icon: Shield,
          title: 'Access Denied',
          message: `This feature requires ${requiredRoles.join(' or ')} privileges.`,
          action: `Your current role: ${currentRole}`,
          actionIcon: AlertTriangle,
          actionColor: 'yellow'
        }
      
      case 'insufficient_permissions':
        return {
          icon: Shield,
          title: 'Insufficient Permissions',
          message: 'You don\'t have the required permissions for this feature.',
          action: 'Contact your administrator for access',
          actionIcon: AlertTriangle,
          actionColor: 'red'
        }
      
      default:
        return {
          icon: AlertTriangle,
          title: 'Access Restricted',
          message: 'You cannot access this feature.',
          action: 'Return to dashboard',
          actionIcon: Home,
          actionColor: 'gray'
        }
    }
  }

  const content = getErrorContent()
  const Icon = content.icon
  const ActionIcon = content.actionIcon

  const colorSchemes = {
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      icon: 'text-blue-400',
      button: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'
    },
    yellow: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      icon: 'text-yellow-400',
      button: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400'
    },
    red: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: 'text-red-400',
      button: 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
    },
    gray: {
      bg: 'bg-gray-500/10',
      border: 'border-gray-500/30',
      icon: 'text-gray-400',
      button: 'bg-gray-500/20 hover:bg-gray-500/30 text-gray-400'
    }
  }

  const colors = colorSchemes[content.actionColor as keyof typeof colorSchemes]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glass-panel p-8 text-center max-w-md border-2 ${colors.border}`}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className={`w-16 h-16 mx-auto mb-6 rounded-full ${colors.bg} flex items-center justify-center`}
        >
          <Icon className={`w-8 h-8 ${colors.icon}`} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-white mb-3">
            {content.title}
          </h2>
          
          <p className="text-white/70 mb-2 leading-relaxed">
            {content.message}
          </p>
          
          <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${colors.bg} ${colors.icon} mb-6`}>
            <ActionIcon className="w-4 h-4" />
            <span>{content.action}</span>
          </div>

          <div className="space-y-3">
            <motion.button
              onClick={() => window.history.back()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full px-6 py-3 rounded-lg transition-colors ${colors.button}`}
            >
              Go Back
            </motion.button>
            
            <motion.button
              onClick={() => window.location.href = '/'}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg transition-colors"
            >
              <Home className="w-4 h-4 inline mr-2" />
              Return to Dashboard
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

// Role-specific component wrappers
export const AdminOnly = withRouteProtection(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  { requiredRoles: ['admin'] }
)

export const AnalystOnly = withRouteProtection(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  { requiredRoles: ['analyst'] }
)

export const AuditorOnly = withRouteProtection(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  { requiredRoles: ['auditor'] }
)

export const AnalystOrAdmin = withRouteProtection(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  { requiredRoles: ['analyst', 'admin'] }
)

export const AuditorOrAdmin = withRouteProtection(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  { requiredRoles: ['auditor', 'admin'] }
)

// Permission-based wrappers
export const RequirePermission = (permission: string) =>
  withRouteProtection(
    ({ children }: { children: React.ReactNode }) => <>{children}</>,
    { requiredPermissions: [permission] }
  )

// Utility hook for conditional rendering based on permissions
export const usePermissionGuard = () => {
  const { hasRole, hasPermission, userProfile } = useAuth()
  
  return {
    canAccess: (roles: string[], permissions: string[] = []) => {
      if (roles.length > 0 && !hasRole(roles)) return false
      if (permissions.length > 0 && !permissions.every(p => hasPermission(p))) return false
      return true
    },
    
    isAdmin: () => hasRole(['admin']),
    isAnalyst: () => hasRole(['analyst']),
    isAuditor: () => hasRole(['auditor']),
    
    canManageUsers: () => hasPermission('create:users'),
    canViewAuditLogs: () => hasPermission('view:audit-logs'),
    canCreateJobs: () => hasPermission('create:jobs'),
    canEditSettings: () => hasPermission('edit:system-settings'),
    
    getCurrentRole: () => userProfile?.role || null
  }
}

// Route protection decorator for class components
export function ProtectedRoute(config: RouteProtectionConfig) {
  return function<T extends React.ComponentType<any>>(target: T): T {
    return withRouteProtection(target, config) as any
  }
}

// Navigation guard hook
export const useNavigationGuard = () => {
  const { hasRole, hasPermission } = useAuth()
  
  return {
    canNavigateTo: (route: string): boolean => {
      const routePermissions: Record<string, { roles?: string[]; permissions?: string[] }> = {
        '/admin': { roles: ['admin'] },
        '/users': { roles: ['admin'] },
        '/audit': { roles: ['admin', 'auditor'] },
        '/settings': { roles: ['admin'] },
        '/analytics': { roles: ['admin', 'analyst', 'auditor'] },
        '/jobs': { roles: ['admin', 'analyst'] }
      }
      
      const requirement = routePermissions[route]
      if (!requirement) return true
      
      if (requirement.roles && !hasRole(requirement.roles)) return false
      if (requirement.permissions && !requirement.permissions.every(p => hasPermission(p))) return false
      
      return true
    }
  }
}
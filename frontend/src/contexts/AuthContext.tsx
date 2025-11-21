import React, { createContext, useContext, useEffect, useState } from 'react'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { supabase, User, getUserProfile } from '../lib/supabase'
import { auditLogger } from '../utils/auditLogger'
import { notifications } from '../utils/notifications'
import { useSecurity } from '../utils/security'

interface AuthContextType {
  user: SupabaseUser | null
  userProfile: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  hasRole: (roles: string | string[]) => boolean
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Role-based permissions mapping
const rolePermissions = {
  admin: [
    'view:dashboard',
    'view:analytics',
    'view:audit-logs',
    'create:users',
    'edit:users',
    'delete:users',
    'view:jobs',
    'create:jobs',
    'edit:jobs',
    'delete:jobs',
    'view:system-settings',
    'edit:system-settings'
  ],
  analyst: [
    'view:dashboard',
    'view:analytics',
    'view:jobs',
    'create:jobs',
    'edit:own-jobs'
  ],
  auditor: [
    'view:dashboard',
    'view:audit-logs',
    'view:jobs',
    'view:analytics'
  ]
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const { handleSecureLogin, handleSecureLogout } = useSecurity()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await loadUserProfile(session.user.id)
        
        // Create audit log for sign in events
        if (event === 'SIGNED_IN') {
          try {
            auditLogger.setUser(session.user.id);
            await auditLogger.logLogin(session.user.id, 'email_password');
            
            // Show welcome notification after profile loads
            setTimeout(() => {
              const profile = getUserProfile(session.user.id);
              profile.then((userProfile) => {
                if (userProfile) {
                  notifications.loginSuccess(userProfile.role);
                }
              });
            }, 1000);
          } catch (error) {
            console.error('Failed to create login audit log:', error);
          }
        }
      } else {
        setUserProfile(null)
        setLoading(false)
        
        // Create audit log for sign out events
        if (event === 'SIGNED_OUT' && user?.id) {
          try {
            await auditLogger.logLogout(user.id);
            auditLogger.setUser(null);
            notifications.logoutSuccess();
          } catch (error) {
            console.error('Failed to create logout audit log:', error);
          }
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserProfile = async (userId: string) => {
    try {
      const profile = await getUserProfile(userId)
      setUserProfile(profile)
    } catch (error) {
      console.error('Error loading user profile:', error)
      setUserProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    
    try {
      const result = await handleSecureLogin(email, password)
      return { error: null, data: result }
    } catch (error: any) {
      // Enhanced error logging
      try {
        await auditLogger.logLoginFailed(email, error.message)
        notifications.loginError(error.message)
      } catch (auditError) {
        console.error('Failed to log login failure:', auditError)
      }
      
      setLoading(false)
      return { error }
    }
  }

  const signOut = async () => {
    setLoading(true)
    
    try {
      // Log logout before clearing session
      if (user && userProfile) {
        await auditLogger.logLogout(user.id)
      }
      
      // Use secure logout
      await handleSecureLogout()
      
      // Show logout notification
      notifications.logoutSuccess()
      
      return { error: null }
    } catch (error: any) {
      console.error('Logout error:', error)
      return { error }
    } finally {
      setLoading(false)
    }
  }

  const hasRole = (roles: string | string[]): boolean => {
    if (!userProfile) return false
    const roleArray = Array.isArray(roles) ? roles : [roles]
    return roleArray.includes(userProfile.role)
  }

  const hasPermission = (permission: string): boolean => {
    if (!userProfile) return false
    const userPermissions = rolePermissions[userProfile.role] || []
    return userPermissions.includes(permission)
  }

  const value: AuthContextType = {
    user,
    userProfile,
    session,
    loading,
    signIn,
    signOut,
    hasRole,
    hasPermission,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Enhanced Higher-order component for route protection (legacy support)
// Note: Use withRouteProtection from RouteProtection.tsx for new implementations
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredRoles?: string[]
) {
  return function AuthenticatedComponent(props: P) {
    const { user, userProfile, loading, hasRole } = useAuth()

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
          <div className="glass-panel p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
            <p className="text-white/80">Loading...</p>
          </div>
        </div>
      )
    }

    if (!user || !userProfile) {
      return <LoginFormPlaceholder />
    }

    if (requiredRoles && !hasRole(requiredRoles)) {
      // Log unauthorized access attempt
      try {
        auditLogger.logPermissionDenied('route_access', 'component', userProfile.role)
        notifications.permissionDenied('access this page')
      } catch (error) {
        console.error('Failed to log permission denied:', error)
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
          <div className="glass-panel p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
            <p className="text-white/80 mb-6">You don't have permission to access this page.</p>
            <p className="text-white/60 mb-6">Required: {requiredRoles.join(' or ')} | Your role: {userProfile.role}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="glass-button px-6 py-2"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )
    }

    return <Component {...props} />
  }
}

// Placeholder login form component
function LoginFormPlaceholder() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="glass-panel p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Authentication Required</h2>
        <p className="text-white/80">Please log in to access this application.</p>
      </div>
    </div>
  )
}
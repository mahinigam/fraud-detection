import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { auditLogger } from '../utils/auditLogger'
import { notifications } from '../utils/notifications'

interface SessionConfig {
  sessionTimeout: number // in milliseconds
  warningTime: number // time before session expires to show warning
  extendOnActivity: boolean
  trackUserActivity: boolean
  maxInactiveTime: number
}

interface SessionState {
  isActive: boolean
  timeRemaining: number
  lastActivity: number
  warningShown: boolean
  isExtending: boolean
}

export const useSessionManagement = (config?: Partial<SessionConfig>) => {
  const { user, userProfile, signOut } = useAuth()
  
  // Default configuration
  const sessionConfig: SessionConfig = {
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 5 * 60 * 1000, // 5 minutes warning
    extendOnActivity: true,
    trackUserActivity: true,
    maxInactiveTime: 10 * 60 * 1000, // 10 minutes of inactivity
    ...config
  }

  const [sessionState, setSessionState] = useState<SessionState>({
    isActive: true,
    timeRemaining: sessionConfig.sessionTimeout,
    lastActivity: Date.now(),
    warningShown: false,
    isExtending: false
  })

  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const warningTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const activityTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Activity tracking
  const updateActivity = useCallback(() => {
    if (!sessionConfig.trackUserActivity || !user) return

    const now = Date.now()
    setSessionState(prev => ({
      ...prev,
      lastActivity: now,
      warningShown: false
    }))

    // Clear existing timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)

    // Reset session timer
    startSessionTimer()

    // Log activity if it's been a while
    if (userProfile && now - sessionState.lastActivity > 60000) { // 1 minute
      auditLogger.logSessionActivity('user_activity', userProfile.role)
    }
  }, [user, userProfile, sessionConfig.trackUserActivity, sessionState.lastActivity])

  // Start session timeout timer
  const startSessionTimer = useCallback(() => {
    if (!user) return

    // Set warning timeout
    warningTimeoutRef.current = setTimeout(() => {
      if (!sessionState.warningShown) {
        setSessionState(prev => ({ ...prev, warningShown: true }))
        notifications.sessionWarning(Math.floor(sessionConfig.warningTime / 60000))
        
        if (userProfile) {
          auditLogger.logSessionActivity('session_warning', userProfile.role)
        }
      }
    }, sessionConfig.sessionTimeout - sessionConfig.warningTime)

    // Set session expiry timeout
    timeoutRef.current = setTimeout(() => {
      handleSessionTimeout()
    }, sessionConfig.sessionTimeout)

    // Set activity tracking timeout
    if (sessionConfig.trackUserActivity) {
      activityTimeoutRef.current = setTimeout(() => {
        if (Date.now() - sessionState.lastActivity > sessionConfig.maxInactiveTime) {
          handleInactivityTimeout()
        }
      }, sessionConfig.maxInactiveTime)
    }
  }, [user, userProfile, sessionConfig, sessionState.lastActivity, sessionState.warningShown])

  // Handle session timeout
  const handleSessionTimeout = useCallback(async () => {
    try {
      if (userProfile) {
        await auditLogger.logSessionActivity('session_timeout', userProfile.role)
      }
      
      notifications.sessionExpired()
      await signOut()
      
      // Clear all timers
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
      
    } catch (error) {
      console.error('Error handling session timeout:', error)
    }
  }, [userProfile, signOut])

  // Handle inactivity timeout
  const handleInactivityTimeout = useCallback(async () => {
    try {
      if (userProfile) {
        await auditLogger.logSessionActivity('inactivity_timeout', userProfile.role)
      }
      
      notifications.inactivityWarning()
      await signOut()
      
    } catch (error) {
      console.error('Error handling inactivity timeout:', error)
    }
  }, [userProfile, signOut])

  // Extend session
  const extendSession = useCallback(async () => {
    if (!user || sessionState.isExtending) return

    try {
      setSessionState(prev => ({ ...prev, isExtending: true }))

      // Refresh the Supabase session
      const { data: { session }, error } = await supabase.auth.refreshSession()
      
      if (error) throw error

      if (session && userProfile) {
        await auditLogger.logSessionActivity('session_extended', userProfile.role)
        notifications.sessionExtended()
        
        // Reset session state
        setSessionState({
          isActive: true,
          timeRemaining: sessionConfig.sessionTimeout,
          lastActivity: Date.now(),
          warningShown: false,
          isExtending: false
        })

        // Restart timers
        startSessionTimer()
      }
    } catch (error) {
      console.error('Error extending session:', error)
      notifications.sessionExtensionFailed()
      setSessionState(prev => ({ ...prev, isExtending: false }))
    }
  }, [user, userProfile, sessionState.isExtending, sessionConfig.sessionTimeout, startSessionTimer])

  // Force logout
  const forceLogout = useCallback(async (reason: string = 'manual') => {
    try {
      if (userProfile) {
        await auditLogger.logSessionActivity('force_logout', userProfile.role, { reason })
      }
      
      notifications.logoutInitiated()
      
      // Clear all timers
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
      
      await signOut()
      
    } catch (error) {
      console.error('Error during force logout:', error)
    }
  }, [userProfile, signOut])

  // Get session info
  const getSessionInfo = useCallback(() => {
    const now = Date.now()
    const timeSinceActivity = now - sessionState.lastActivity
    const remainingTime = Math.max(0, sessionConfig.sessionTimeout - timeSinceActivity)
    
    return {
      isActive: sessionState.isActive,
      timeRemaining: remainingTime,
      timeSinceActivity,
      warningShown: sessionState.warningShown,
      isExtending: sessionState.isExtending,
      shouldWarn: remainingTime <= sessionConfig.warningTime && remainingTime > 0,
      willExpireIn: Math.floor(remainingTime / 60000), // minutes
      config: sessionConfig
    }
  }, [sessionState, sessionConfig])

  // Activity listeners
  useEffect(() => {
    if (!sessionConfig.trackUserActivity || !user) return

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const throttledUpdateActivity = (() => {
      let lastCall = 0
      const delay = 10000 // 10 seconds throttle
      
      return () => {
        const now = Date.now()
        if (now - lastCall >= delay) {
          lastCall = now
          updateActivity()
        }
      }
    })()

    events.forEach(event => {
      document.addEventListener(event, throttledUpdateActivity, true)
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledUpdateActivity, true)
      })
    }
  }, [sessionConfig.trackUserActivity, user, updateActivity])

  // Initialize session when user logs in
  useEffect(() => {
    if (user && sessionState.isActive) {
      startSessionTimer()
      
      if (userProfile) {
        auditLogger.logSessionActivity('session_started', userProfile.role)
      }
    }

    return () => {
      // Cleanup on unmount
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    }
  }, [user, userProfile, startSessionTimer])

  // Monitor session token validity
  useEffect(() => {
    if (!user) return

    const checkTokenValidity = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          // Session is invalid, force logout
          await forceLogout('invalid_token')
        } else if (session.expires_at) {
          const expiresAt = new Date(session.expires_at * 1000)
          const now = new Date()
          const timeUntilExpiry = expiresAt.getTime() - now.getTime()
          
          // If token expires soon, try to refresh
          if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) { // 5 minutes
            await extendSession()
          }
        }
      } catch (error) {
        console.error('Error checking token validity:', error)
      }
    }

    // Check token validity periodically
    const tokenCheckInterval = setInterval(checkTokenValidity, 60000) // Every minute
    
    return () => clearInterval(tokenCheckInterval)
  }, [user, extendSession, forceLogout])

  return {
    sessionState,
    sessionInfo: getSessionInfo(),
    extendSession,
    forceLogout,
    updateActivity,
    getSessionInfo
  }
}

// Session management context and hook
export interface SessionWarningModalProps {
  isOpen: boolean
  timeRemaining: number
  onExtend: () => void
  onLogout: () => void
}

export const SessionWarningModal = ({ 
  isOpen, 
  timeRemaining, 
  onExtend, 
  onLogout 
}: SessionWarningModalProps) => {
  if (!isOpen) return null

  const minutes = Math.ceil(timeRemaining / 60000)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel p-6 max-w-md w-full text-center border-2 border-yellow-500/30">
        <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/10 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-yellow-400"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2">
          Session Expiring Soon
        </h3>
        
        <p className="text-white/70 mb-6">
          Your session will expire in <span className="font-bold text-yellow-400">{minutes}</span> minute{minutes !== 1 ? 's' : ''}.
          <br />
          Would you like to extend your session?
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
          >
            Logout Now
          </button>
          <button
            onClick={onExtend}
            className="flex-1 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
          >
            Extend Session
          </button>
        </div>
      </div>
    </div>
  )
}
// Mock AuthContext FIRST, before any imports
import { vi } from 'vitest'

// Create mock functions
const mockSignOut = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    userProfile: { role: 'admin' },
    signOut: mockSignOut
  })
}))

import { expect, describe, it, beforeEach } from '../../test/setup'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { afterEach } from 'vitest'

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      refreshSession: vi.fn().mockResolvedValue({ 
        data: { session: { access_token: 'new-token' } }, 
        error: null 
      })
    }
  }
}))

// Mock audit logger and notifications
vi.mock('../../utils/auditLogger', () => ({
  auditLogger: {
    logSessionEvent: vi.fn(),
    logSecurityEvent: vi.fn(),
    logSessionActivity: vi.fn()
  }
}))

vi.mock('../../utils/notifications', () => ({
  notifications: {
    sessionWarning: vi.fn(),
    logoutInitiated: vi.fn(),
    sessionExtensionFailed: vi.fn(),
    sessionExpired: vi.fn()
  }
}))

// Import after mocking
import { useSessionManagement } from '../useSessionManagement'

describe('useSessionManagement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default session state', () => {
      const { result } = renderHook(() => useSessionManagement())
      
      expect(result.current.sessionState).toBeDefined()
      expect(result.current.sessionState.isActive).toBe(true)
      expect(result.current.sessionState.timeRemaining).toBe(30 * 60 * 1000) // 30 minutes default
      expect(result.current.sessionState.lastActivity).toBeGreaterThan(0)
      expect(result.current.sessionState.warningShown).toBe(false)
      expect(result.current.sessionState.isExtending).toBe(false)
    })

    it('should accept custom configuration', () => {
      const customConfig = {
        sessionTimeout: 15 * 60 * 1000, // 15 minutes
        warningTime: 2 * 60 * 1000, // 2 minutes
        extendOnActivity: false,
        trackUserActivity: false,
        maxInactiveTime: 5 * 60 * 1000 // 5 minutes
      }

      const { result } = renderHook(() => useSessionManagement(customConfig))
      
      expect(result.current.sessionState.timeRemaining).toBe(15 * 60 * 1000)
      expect(result.current.sessionInfo.config.sessionTimeout).toBe(15 * 60 * 1000)
      expect(result.current.sessionInfo.config.warningTime).toBe(2 * 60 * 1000)
    })

    it('should return session info with computed values', () => {
      const { result } = renderHook(() => useSessionManagement())
      
      const sessionInfo = result.current.sessionInfo
      expect(sessionInfo.isActive).toBe(true)
      expect(sessionInfo.timeRemaining).toBeGreaterThan(0)
      expect(sessionInfo.timeSinceActivity).toBeGreaterThanOrEqual(0)
      expect(sessionInfo.warningShown).toBe(false)
      expect(sessionInfo.isExtending).toBe(false)
      expect(sessionInfo.shouldWarn).toBe(false)
      expect(sessionInfo.willExpireIn).toBeGreaterThan(0)
      expect(sessionInfo.config).toBeDefined()
    })
  })

  describe('Activity Tracking', () => {
    it('should update activity when called', () => {
      const { result } = renderHook(() => useSessionManagement())
      
      const initialLastActivity = result.current.sessionState.lastActivity
      
      act(() => {
        vi.advanceTimersByTime(1000) // Wait 1 second
      })

      act(() => {
        result.current.updateActivity()
      })
      
      expect(result.current.sessionState.lastActivity).toBeGreaterThan(initialLastActivity)
    })

    it('should reset time remaining when activity is updated', () => {
      const { result } = renderHook(() => useSessionManagement({
        sessionTimeout: 10 * 60 * 1000 // 10 minutes
      }))
      
      // Wait 5 minutes
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000)
      })

      const timeBeforeActivity = result.current.sessionState.timeRemaining
      
      act(() => {
        result.current.updateActivity()
      })
      
      // Time remaining should be reset to full session timeout
      expect(result.current.sessionState.timeRemaining).toBeGreaterThan(timeBeforeActivity)
    })
  })

  describe('Session Extension', () => {
    it('should extend session when extendSession is called', async () => {
      const { result } = renderHook(() => useSessionManagement())
      
      await act(async () => {
        await result.current.extendSession()
      })
      
      // Should reset to full session timeout
      expect(result.current.sessionState.timeRemaining).toBe(30 * 60 * 1000)
      expect(result.current.sessionState.warningShown).toBe(false)
    })
  })

  describe('Force Logout', () => {
    it('should force logout and clear session', async () => {
      const { result } = renderHook(() => useSessionManagement())
      
      await act(async () => {
        await result.current.forceLogout('test_reason')
      })
      
      expect(mockSignOut).toHaveBeenCalled()
      expect(result.current.sessionState.isActive).toBe(false)
    })

    it('should handle logout with default reason', async () => {
      const { result } = renderHook(() => useSessionManagement())
      
      await act(async () => {
        await result.current.forceLogout()
      })
      
      expect(mockSignOut).toHaveBeenCalled()
    })
  })

  describe('Session Timeout Behavior', () => {
    it('should show warning when approaching timeout', () => {
      const { result } = renderHook(() => useSessionManagement({
        sessionTimeout: 10 * 60 * 1000, // 10 minutes
        warningTime: 2 * 60 * 1000 // 2 minutes warning
      }))
      
      // Fast forward to warning threshold (8 minutes, leaving 2 minutes)
      act(() => {
        vi.advanceTimersByTime(8 * 60 * 1000)
      })
      
      expect(result.current.sessionInfo.shouldWarn).toBe(true)
      expect(result.current.sessionInfo.willExpireIn).toBeLessThanOrEqual(2 * 60 * 1000)
    })

    it('should handle session expiration', () => {
      const { result } = renderHook(() => useSessionManagement({
        sessionTimeout: 5 * 60 * 1000 // 5 minutes
      }))
      
      // Fast forward past expiration
      act(() => {
        vi.advanceTimersByTime(6 * 60 * 1000)
      })
      
      expect(result.current.sessionState.timeRemaining).toBeLessThanOrEqual(0)
      expect(result.current.sessionInfo.isActive).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should clean up timers on unmount', () => {
      const { unmount } = renderHook(() => useSessionManagement())
      
      // Should not throw on unmount
      expect(() => unmount()).not.toThrow()
    })
  })
})
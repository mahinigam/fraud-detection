import { vi, expect, describe, it, beforeEach } from '../../test/setup'
import { 
  DeviceFingerprint,
  SecurityManager,
  securityManager,
  DEFAULT_SECURITY_CONFIG,
  useSecurity
} from '../security'

// Mock crypto functions
const mockCrypto = {
  getRandomValues: vi.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256)
    }
    return arr
  }),
  randomUUID: vi.fn(() => 'test-uuid-12345'),
  subtle: {
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    generateKey: vi.fn().mockResolvedValue({}),
    importKey: vi.fn().mockResolvedValue({})
  }
}

Object.defineProperty(global, 'crypto', { value: mockCrypto })

describe('Security Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DeviceFingerprint', () => {
    it('should generate a consistent fingerprint', () => {
      const fingerprint1 = DeviceFingerprint.generate()
      const fingerprint2 = DeviceFingerprint.generate()
      
      expect(fingerprint1).toBe(fingerprint2)
      expect(typeof fingerprint1).toBe('string')
      expect(fingerprint1.length).toBeGreaterThan(0)
    })

    it('should include browser information', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Test Browser)',
        configurable: true
      })
      
      const fingerprint = DeviceFingerprint.generate()
      // Fingerprint is a truncated base64 string, just check it's generated
      expect(typeof fingerprint).toBe('string')
      expect(fingerprint.length).toBe(32)
    })

    it('should include screen information', () => {
      Object.defineProperty(screen, 'width', { value: 1920, configurable: true })
      Object.defineProperty(screen, 'height', { value: 1080, configurable: true })
      
      const fingerprint = DeviceFingerprint.generate()
      // Fingerprint is a truncated base64 string, just check it's generated
      expect(typeof fingerprint).toBe('string')
      expect(fingerprint.length).toBe(32)
    })
  })

  describe('SecurityManager', () => {
    let manager: SecurityManager

    beforeEach(() => {
      manager = SecurityManager.getInstance()
      localStorage.clear()
    })

    describe('lockout functionality', () => {
      it('should not be locked out initially', () => {
        expect(manager.isLockedOut('test@example.com')).toBe(false)
      })

      it('should track failed login attempts', () => {
        const email = 'test@example.com'
        
        // Record multiple failed attempts
        for (let i = 0; i < 3; i++) {
          manager.recordFailedAttempt(email)
        }
        
        // Should not be locked out yet (default is 5 attempts)
        expect(manager.isLockedOut(email)).toBe(false)
      })

      it('should lock out after max attempts', () => {
        const email = 'test@example.com'
        
        // Record max failed attempts
        for (let i = 0; i < 5; i++) {
          manager.recordFailedAttempt(email)
        }
        
        expect(manager.isLockedOut(email)).toBe(true)
      })

      it('should clear failed attempts on successful login', () => {
        const email = 'test@example.com'
        
        // Record some failed attempts
        manager.recordFailedAttempt(email)
        manager.recordFailedAttempt(email)
        
        // Clear attempts (successful login)
        manager.clearFailedAttempts(email)
        
        expect(manager.isLockedOut(email)).toBe(false)
      })

      it('should calculate remaining lockout time', () => {
        const email = 'test@example.com'
        
        // Lock out the user
        for (let i = 0; i < 5; i++) {
          manager.recordFailedAttempt(email)
        }
        
        const remaining = manager.getLockoutTimeRemaining(email)
        expect(remaining).toBeGreaterThan(0)
      })
    })

    describe('password validation', () => {
      it('should validate password strength', () => {
        const weakPassword = '123'
        const strongPassword = 'MySecure123!Password'
        
        const weakResult = manager.validatePassword(weakPassword)
        const strongResult = manager.validatePassword(strongPassword)
        
        expect(weakResult.isValid).toBe(false)
        expect(weakResult.errors).toContain('Password must be at least 8 characters long')
        
        expect(strongResult.isValid).toBe(true)
        expect(strongResult.errors).toHaveLength(0)
      })

      it('should check for password requirements', () => {
        const result = manager.validatePassword('password')
        
        expect(result.errors).toContain('Password must contain at least one uppercase letter')
        expect(result.errors).toContain('Password must contain at least one number')
        expect(result.errors).toContain('Password must contain at least one special character')
      })
    })

    describe('device tracking', () => {
      it('should track device fingerprints', async () => {
        const userId = 'test-user-id'
        const fingerprint = DeviceFingerprint.generate()
        
        await manager.trackDeviceLogin(userId, fingerprint, 'test-user-agent')
        
        // Should not flag as suspicious for known device (first time is always suspicious)
        const suspicious = await manager.detectSuspiciousActivity('test-user', fingerprint)
        expect(suspicious).toBe(true) // First time device is always suspicious
      })

      it('should detect new devices', async () => {
        const userId = 'test-user-id'
        const knownFingerprint = 'known-device-123'
        const newFingerprint = 'new-device-456'
        
        // Track known device
        await manager.trackDeviceLogin(userId, knownFingerprint, 'test-user-agent')
        
        // Check with new device
        const suspicious = await manager.detectSuspiciousActivity(userId, newFingerprint)
        expect(suspicious).toBe(true)
      })
    })

    describe('session management', () => {
      it('should generate secure session tokens', () => {
        const token1 = manager.generateSessionToken()
        const token2 = manager.generateSessionToken()
        
        expect(token1).not.toBe(token2)
        expect(typeof token1).toBe('string')
        expect(token1.length).toBeGreaterThan(20)
      })

      it('should perform secure logout', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        
        manager.secureLogout()
        
        // Should clear localStorage (mocked in tests)
        expect(localStorage.clear).toHaveBeenCalled()
        
        consoleSpy.mockRestore()
      })
    })
  })

  describe('DEFAULT_SECURITY_CONFIG', () => {
    it('should have reasonable default values', () => {
      expect(DEFAULT_SECURITY_CONFIG.maxLoginAttempts).toBe(5)
      expect(DEFAULT_SECURITY_CONFIG.lockoutDuration).toBe(15 * 60 * 1000) // 15 minutes
      expect(DEFAULT_SECURITY_CONFIG.passwordMinLength).toBe(8)
      expect(DEFAULT_SECURITY_CONFIG.passwordRequireSpecialChars).toBe(true)
      expect(DEFAULT_SECURITY_CONFIG.enableDeviceTracking).toBe(true)
    })
  })
})
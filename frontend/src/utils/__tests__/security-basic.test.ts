import { vi, expect, describe, it, beforeEach } from '../../test/setup'
import { DEFAULT_SECURITY_CONFIG, DeviceFingerprint } from '../security'

describe('Security Utils Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DeviceFingerprint', () => {
    it('should generate a fingerprint string', () => {
      const fingerprint = DeviceFingerprint.generate()
      
      expect(typeof fingerprint).toBe('string')
      expect(fingerprint.length).toBeGreaterThan(0)
    })

    it('should generate consistent fingerprints', () => {
      const fingerprint1 = DeviceFingerprint.generate()
      const fingerprint2 = DeviceFingerprint.generate()
      
      // Should be consistent within the same environment
      expect(fingerprint1).toBe(fingerprint2)
    })
  })

  describe('DEFAULT_SECURITY_CONFIG', () => {
    it('should have reasonable default values', () => {
      expect(DEFAULT_SECURITY_CONFIG).toHaveProperty('maxLoginAttempts')
      expect(DEFAULT_SECURITY_CONFIG).toHaveProperty('lockoutDuration')
      expect(DEFAULT_SECURITY_CONFIG).toHaveProperty('passwordMinLength')
      expect(DEFAULT_SECURITY_CONFIG).toHaveProperty('enableDeviceTracking')
      
      expect(DEFAULT_SECURITY_CONFIG.maxLoginAttempts).toBeGreaterThan(0)
      expect(DEFAULT_SECURITY_CONFIG.lockoutDuration).toBeGreaterThan(0)
      expect(DEFAULT_SECURITY_CONFIG.passwordMinLength).toBeGreaterThan(0)
      expect(typeof DEFAULT_SECURITY_CONFIG.enableDeviceTracking).toBe('boolean')
    })

    it('should have secure default settings', () => {
      expect(DEFAULT_SECURITY_CONFIG.maxLoginAttempts).toBeLessThanOrEqual(10) // Not too permissive
      expect(DEFAULT_SECURITY_CONFIG.passwordMinLength).toBeGreaterThanOrEqual(8) // Strong passwords
      expect(DEFAULT_SECURITY_CONFIG.passwordRequireSpecialChars).toBe(true)
      expect(DEFAULT_SECURITY_CONFIG.passwordRequireNumbers).toBe(true)
      expect(DEFAULT_SECURITY_CONFIG.passwordRequireUppercase).toBe(true)
    })

    it('should have appropriate timeout settings', () => {
      expect(DEFAULT_SECURITY_CONFIG.sessionInactivityTimeout).toBeGreaterThan(5 * 60 * 1000) // At least 5 minutes
      expect(DEFAULT_SECURITY_CONFIG.lockoutDuration).toBeGreaterThan(60 * 1000) // At least 1 minute
    })
  })

  describe('Security Configuration Validation', () => {
    it('should validate configuration object structure', () => {
      const requiredFields = [
        'maxLoginAttempts',
        'lockoutDuration',
        'passwordMinLength',
        'passwordRequireSpecialChars',
        'passwordRequireNumbers', 
        'passwordRequireUppercase',
        'sessionInactivityTimeout',
        'enableDeviceTracking',
        'enableLocationTracking',
        'allowMultipleSessions'
      ]

      requiredFields.forEach(field => {
        expect(DEFAULT_SECURITY_CONFIG).toHaveProperty(field)
        expect(DEFAULT_SECURITY_CONFIG[field as keyof typeof DEFAULT_SECURITY_CONFIG]).toBeDefined()
      })
    })

    it('should have consistent data types', () => {
      expect(typeof DEFAULT_SECURITY_CONFIG.maxLoginAttempts).toBe('number')
      expect(typeof DEFAULT_SECURITY_CONFIG.lockoutDuration).toBe('number')
      expect(typeof DEFAULT_SECURITY_CONFIG.passwordMinLength).toBe('number')
      expect(typeof DEFAULT_SECURITY_CONFIG.passwordRequireSpecialChars).toBe('boolean')
      expect(typeof DEFAULT_SECURITY_CONFIG.passwordRequireNumbers).toBe('boolean')
      expect(typeof DEFAULT_SECURITY_CONFIG.passwordRequireUppercase).toBe('boolean')
      expect(typeof DEFAULT_SECURITY_CONFIG.sessionInactivityTimeout).toBe('number')
      expect(typeof DEFAULT_SECURITY_CONFIG.enableDeviceTracking).toBe('boolean')
      expect(typeof DEFAULT_SECURITY_CONFIG.enableLocationTracking).toBe('boolean')
      expect(typeof DEFAULT_SECURITY_CONFIG.allowMultipleSessions).toBe('boolean')
    })
  })
})
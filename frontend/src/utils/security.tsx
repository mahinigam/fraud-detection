import { supabase } from '../lib/supabase'
import { auditLogger } from '../utils/auditLogger'
import { notifications } from '../utils/notifications'

// Security configuration
export interface SecurityConfig {
  maxLoginAttempts: number
  lockoutDuration: number // in milliseconds
  passwordMinLength: number
  passwordRequireSpecialChars: boolean
  passwordRequireNumbers: boolean
  passwordRequireUppercase: boolean
  sessionInactivityTimeout: number
  enableDeviceTracking: boolean
  enableLocationTracking: boolean
  allowMultipleSessions: boolean
}

// Default security configuration
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  passwordMinLength: 8,
  passwordRequireSpecialChars: true,
  passwordRequireNumbers: true,
  passwordRequireUppercase: true,
  sessionInactivityTimeout: 30 * 60 * 1000, // 30 minutes
  enableDeviceTracking: true,
  enableLocationTracking: false, // Disabled by default for privacy
  allowMultipleSessions: false
}

// Device fingerprinting
export class DeviceFingerprint {
  static generate(): string {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx!.textBaseline = 'top'
    ctx!.font = '14px Arial'
    ctx!.fillText('Device fingerprint', 2, 2)
    
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}`,
      canvas: canvas.toDataURL(),
      plugins: Array.from(navigator.plugins).map(p => p.name).sort().join(','),
      webgl: this.getWebGLRenderer()
    }
    
    return btoa(JSON.stringify(fingerprint)).substring(0, 32)
  }
  
  private static getWebGLRenderer(): string {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') as WebGLRenderingContext | null
      if (!gl) return 'unsupported'
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      return debugInfo ? gl.getParameter((debugInfo as any).UNMASKED_RENDERER_WEBGL) : 'unknown'
    } catch {
      return 'error'
    }
  }
}

// Security manager class
export class SecurityManager {
  private static instance: SecurityManager
  private config: SecurityConfig
  private failedAttempts: Map<string, { count: number; lastAttempt: number }> = new Map()
  
  private constructor(config: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
    this.config = config
    this.loadFailedAttempts()
  }
  
  static getInstance(config?: SecurityConfig): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager(config)
    }
    return SecurityManager.instance
  }
  
  // Load failed attempts from localStorage
  private loadFailedAttempts() {
    try {
      const stored = localStorage.getItem('security_failed_attempts')
      if (stored) {
        const data = JSON.parse(stored)
        this.failedAttempts = new Map(Object.entries(data).map(([k, v]: [string, any]) => [
          k, 
          { count: v.count, lastAttempt: v.lastAttempt }
        ]))
      }
    } catch (error) {
      console.warn('Failed to load security data:', error)
    }
  }
  
  // Save failed attempts to localStorage
  private saveFailedAttempts() {
    try {
      const data = Object.fromEntries(this.failedAttempts)
      localStorage.setItem('security_failed_attempts', JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save security data:', error)
    }
  }
  
  // Check if user/IP is locked out
  isLockedOut(identifier: string): boolean {
    const attempts = this.failedAttempts.get(identifier)
    if (!attempts) return false
    
    const now = Date.now()
    const timeSinceLastAttempt = now - attempts.lastAttempt
    
    // Clear lockout if duration has passed
    if (timeSinceLastAttempt >= this.config.lockoutDuration) {
      this.failedAttempts.delete(identifier)
      this.saveFailedAttempts()
      return false
    }
    
    return attempts.count >= this.config.maxLoginAttempts
  }
  
  // Record failed login attempt
  recordFailedAttempt(identifier: string) {
    const now = Date.now()
    const current = this.failedAttempts.get(identifier) || { count: 0, lastAttempt: now }
    
    // Reset count if last attempt was beyond lockout duration
    if (now - current.lastAttempt >= this.config.lockoutDuration) {
      current.count = 0
    }
    
    current.count++
    current.lastAttempt = now
    
    this.failedAttempts.set(identifier, current)
    this.saveFailedAttempts()
    
    // Log security event
    auditLogger.log('login_attempt_failed', 'security', identifier, {
      attempt_count: current.count,
      is_locked_out: current.count >= this.config.maxLoginAttempts
    })
    
    // Notify if locked out
    if (current.count >= this.config.maxLoginAttempts) {
      notifications.error(`Account locked due to too many failed attempts. Try again in ${Math.ceil(this.config.lockoutDuration / 60000)} minutes.`)
    }
  }
  
  // Clear failed attempts (successful login)
  clearFailedAttempts(identifier: string) {
    if (this.failedAttempts.has(identifier)) {
      this.failedAttempts.delete(identifier)
      this.saveFailedAttempts()
    }
  }
  
  // Get lockout time remaining
  getLockoutTimeRemaining(identifier: string): number {
    const attempts = this.failedAttempts.get(identifier)
    if (!attempts) return 0
    
    const now = Date.now()
    const timeSinceLastAttempt = now - attempts.lastAttempt
    const remaining = this.config.lockoutDuration - timeSinceLastAttempt
    
    return Math.max(0, remaining)
  }
  
  // Validate password strength
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (password.length < this.config.passwordMinLength) {
      errors.push(`Password must be at least ${this.config.passwordMinLength} characters long`)
    }
    
    if (this.config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    
    if (this.config.passwordRequireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }
    
    if (this.config.passwordRequireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
  
  // Device tracking
  async trackDeviceLogin(userId: string, deviceFingerprint: string, userAgent: string, ipAddress?: string) {
    try {
      await auditLogger.log('device_login', 'security', userId, {
        device_fingerprint: deviceFingerprint,
        user_agent: userAgent,
        ip_address: ipAddress,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.warn('Failed to track device login:', error)
    }
  }
  
  // Check for suspicious activity
  async detectSuspiciousActivity(userId: string, deviceFingerprint: string): Promise<boolean> {
    try {
      // This would typically check against a database of known devices
      const knownDevice = localStorage.getItem(`device_${userId}`)
      
      if (!knownDevice) {
        // First time login from this device
        localStorage.setItem(`device_${userId}`, deviceFingerprint)
        notifications.warning('Login from new device detected')
        
        await auditLogger.log('new_device_login', 'security', userId, {
          device_fingerprint: deviceFingerprint
        })
        
        return true // Suspicious but not necessarily malicious
      }
      
      if (knownDevice !== deviceFingerprint) {
        // Different device fingerprint for known user
        notifications.warning('Login from unrecognized device')
        
        await auditLogger.log('suspicious_device_login', 'security', userId, {
          expected_fingerprint: knownDevice,
          actual_fingerprint: deviceFingerprint
        })
        
        return true
      }
      
      return false
    } catch (error) {
      console.warn('Failed to detect suspicious activity:', error)
      return false
    }
  }
  
  // Generate secure session token
  generateSessionToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }
  
  // Secure logout (clear all sensitive data)
  secureLogout() {
    try {
      // Clear localStorage
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('supabase.auth.') || 
        key.startsWith('device_') ||
        key.startsWith('session_')
      )
      
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      // Clear sessionStorage
      sessionStorage.clear()
      
      // Clear any cached data
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name))
        })
      }
      
      notifications.info('Secure logout completed')
    } catch (error) {
      console.warn('Error during secure logout:', error)
    }
  }
  
  // Rate limiting for API requests
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map()
  
  checkRateLimit(endpoint: string, limit: number = 60, windowMs: number = 60000): boolean {
    const now = Date.now()
    const current = this.rateLimits.get(endpoint)
    
    if (!current || now >= current.resetTime) {
      this.rateLimits.set(endpoint, { count: 1, resetTime: now + windowMs })
      return true
    }
    
    if (current.count >= limit) {
      return false
    }
    
    current.count++
    return true
  }
  
  // Content Security Policy helpers
  static setupCSP() {
    if (typeof document !== 'undefined') {
      const meta = document.createElement('meta')
      meta.httpEquiv = 'Content-Security-Policy'
      meta.content = `
        default-src 'self';
        script-src 'self' 'unsafe-inline' https://unpkg.com;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        font-src 'self' https://fonts.gstatic.com;
        img-src 'self' data: https:;
        connect-src 'self' https://*.supabase.co wss://*.supabase.co;
        frame-ancestors 'none';
        base-uri 'self';
        form-action 'self';
      `.replace(/\s+/g, ' ').trim()
      
      document.head.appendChild(meta)
    }
  }
}

// Export singleton instance
export const securityManager = SecurityManager.getInstance()

// React hook for security features
export const useSecurity = () => {
  const handleSecureLogin = async (email: string, password: string) => {
    // Check if locked out
    if (securityManager.isLockedOut(email)) {
      const remainingTime = securityManager.getLockoutTimeRemaining(email)
      const minutes = Math.ceil(remainingTime / 60000)
      throw new Error(`Account locked. Try again in ${minutes} minutes.`)
    }
    
    // Validate password
    const validation = securityManager.validatePassword(password)
    if (!validation.isValid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`)
    }
    
    // Generate device fingerprint
    const deviceFingerprint = DeviceFingerprint.generate()
    
    try {
      // Attempt login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        // Record failed attempt
        securityManager.recordFailedAttempt(email)
        throw error
      }
      
      if (data.user) {
        // Clear failed attempts on successful login
        securityManager.clearFailedAttempts(email)
        
        // Track device
        await securityManager.trackDeviceLogin(data.user.id, deviceFingerprint, navigator.userAgent)
        
        // Check for suspicious activity
        await securityManager.detectSuspiciousActivity(data.user.id, deviceFingerprint)
        
        return data
      }
      
    } catch (error: any) {
      if (!error?.message?.includes('locked')) {
        securityManager.recordFailedAttempt(email)
      }
      throw error
    }
  }
  
  const handleSecureLogout = async () => {
    try {
      await supabase.auth.signOut()
      securityManager.secureLogout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }
  
  return {
    handleSecureLogin,
    handleSecureLogout,
    validatePassword: (password: string) => securityManager.validatePassword(password),
    isLockedOut: (identifier: string) => securityManager.isLockedOut(identifier),
    getLockoutTimeRemaining: (identifier: string) => securityManager.getLockoutTimeRemaining(identifier),
    generateDeviceFingerprint: () => DeviceFingerprint.generate()
  }
}

// Initialize CSP
if (typeof window !== 'undefined') {
  SecurityManager.setupCSP()
}
// Environment configuration management for Fraud Detection System
// Provides type-safe configuration with validation and feature flags

export type Environment = 'development' | 'staging' | 'production' | 'test'

export interface DatabaseConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceKey?: string // Only for admin operations
  connectionPoolSize?: number
  maxRetries?: number
  timeout?: number
}

export interface APIConfig {
  fraudDetectionEndpoint: string
  apiTimeout: number
  maxRetries: number
  rateLimit: {
    requests: number
    windowMs: number
  }
  cors: {
    origin: string[]
    credentials: boolean
  }
}

// Partial configuration types for environment-specific configs
type PartialDatabaseConfig = Partial<DatabaseConfig>
type PartialAPIConfig = Partial<APIConfig> & {
  rateLimit?: Partial<APIConfig['rateLimit']>
  cors?: Partial<APIConfig['cors']>
}
type PartialSecurityConfig = Partial<SecurityConfig> & {
  passwordPolicy?: Partial<SecurityConfig['passwordPolicy']>
}

interface EnvironmentConfig {
  environment?: Environment
  version?: string
  buildNumber?: string
  database?: PartialDatabaseConfig
  api?: PartialAPIConfig
  security?: PartialSecurityConfig
  features?: Partial<FeatureFlags>
  monitoring?: Partial<MonitoringConfig>
  ui?: Partial<UIConfig>
  debug?: boolean
}

export interface SecurityConfig {
  sessionTimeout: number
  warningTime: number
  maxLoginAttempts: number
  lockoutDuration: number
  passwordPolicy: {
    minLength: number
    requireUppercase: boolean
    requireLowercase: boolean
    requireNumbers: boolean
    requireSpecialChars: boolean
  }
  deviceTracking: boolean
  locationTracking: boolean
  allowMultipleSessions: boolean
  csrfProtection: boolean
  contentSecurityPolicy: string
}

export interface FeatureFlags {
  enableRealTimeUpdates: boolean
  enableAdvancedAnalytics: boolean
  enableAuditLogs: boolean
  enableNotifications: boolean
  enableSessionManagement: boolean
  enableDeviceTracking: boolean
  enableLocationServices: boolean
  enableBatchProcessing: boolean
  enableAutoSave: boolean
  enableThemeToggle: boolean
  enableBetaFeatures: boolean
  maintenanceMode: boolean
}

export interface MonitoringConfig {
  enableAnalytics: boolean
  enableErrorReporting: boolean
  enablePerformanceMonitoring: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  enableConsoleLogging: boolean
  enableRemoteLogging: boolean
  errorReportingEndpoint?: string
  analyticsEndpoint?: string
}

export interface UIConfig {
  theme: 'light' | 'dark' | 'auto'
  language: string
  dateFormat: string
  timezone: string
  itemsPerPage: number
  animationSpeed: 'fast' | 'normal' | 'slow'
  enableAnimations: boolean
  compactMode: boolean
}

export interface AppConfig {
  environment: Environment
  version: string
  buildNumber: string
  database: DatabaseConfig
  api: APIConfig
  security: SecurityConfig
  features: FeatureFlags
  monitoring: MonitoringConfig
  ui: UIConfig
  debug: boolean
}

// Environment-specific configurations
const developmentConfig: EnvironmentConfig = {
  environment: 'development',
  debug: true,
  database: {
    connectionPoolSize: 5,
    maxRetries: 3,
    timeout: 5000
  },
  api: {
    apiTimeout: 10000,
    maxRetries: 3,
    rateLimit: {
      requests: 1000,
      windowMs: 60000
    },
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true
    }
  },
  security: {
    sessionTimeout: 60 * 60 * 1000, // 1 hour in dev
    warningTime: 10 * 60 * 1000, // 10 minutes
    maxLoginAttempts: 10, // More lenient in dev
    lockoutDuration: 5 * 60 * 1000, // 5 minutes
    passwordPolicy: {
      minLength: 6, // Shorter for dev
      requireUppercase: false,
      requireLowercase: true,
      requireNumbers: false,
      requireSpecialChars: false
    },
    deviceTracking: true,
    locationTracking: false,
    allowMultipleSessions: true,
    csrfProtection: false, // Disabled in dev for easier testing
    contentSecurityPolicy: "default-src 'self' 'unsafe-inline' 'unsafe-eval' *"
  },
  features: {
    enableRealTimeUpdates: true,
    enableAdvancedAnalytics: true,
    enableAuditLogs: true,
    enableNotifications: true,
    enableSessionManagement: true,
    enableDeviceTracking: true,
    enableLocationServices: false,
    enableBatchProcessing: true,
    enableAutoSave: true,
    enableThemeToggle: true,
    enableBetaFeatures: true,
    maintenanceMode: false
  },
  monitoring: {
    enableAnalytics: false, // Disabled in dev
    enableErrorReporting: true,
    enablePerformanceMonitoring: false,
    logLevel: 'debug',
    enableConsoleLogging: true,
    enableRemoteLogging: false
  },
  ui: {
    theme: 'dark',
    language: 'en',
    dateFormat: 'MM/dd/yyyy',
    timezone: 'America/New_York',
    itemsPerPage: 10,
    animationSpeed: 'normal',
    enableAnimations: true,
    compactMode: false
  }
}

const stagingConfig: EnvironmentConfig = {
  environment: 'staging',
  debug: false,
  database: {
    connectionPoolSize: 10,
    maxRetries: 5,
    timeout: 8000
  },
  api: {
    apiTimeout: 15000,
    maxRetries: 5,
    rateLimit: {
      requests: 500,
      windowMs: 60000
    },
    cors: {
      origin: ['https://staging.frauddetection.com'],
      credentials: true
    }
  },
  security: {
    sessionTimeout: 45 * 60 * 1000, // 45 minutes
    warningTime: 5 * 60 * 1000,
    maxLoginAttempts: 7,
    lockoutDuration: 10 * 60 * 1000, // 10 minutes
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false
    },
    deviceTracking: true,
    locationTracking: false,
    allowMultipleSessions: false,
    csrfProtection: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co;"
  },
  features: {
    enableRealTimeUpdates: true,
    enableAdvancedAnalytics: true,
    enableAuditLogs: true,
    enableNotifications: true,
    enableSessionManagement: true,
    enableDeviceTracking: true,
    enableLocationServices: false,
    enableBatchProcessing: true,
    enableAutoSave: true,
    enableThemeToggle: true,
    enableBetaFeatures: false, // Disabled in staging
    maintenanceMode: false
  },
  monitoring: {
    enableAnalytics: true,
    enableErrorReporting: true,
    enablePerformanceMonitoring: true,
    logLevel: 'info',
    enableConsoleLogging: false,
    enableRemoteLogging: true
  },
  ui: {
    theme: 'dark',
    language: 'en',
    dateFormat: 'MM/dd/yyyy',
    timezone: 'America/New_York',
    itemsPerPage: 25,
    animationSpeed: 'normal',
    enableAnimations: true,
    compactMode: false
  }
}

const productionConfig: EnvironmentConfig = {
  environment: 'production',
  debug: false,
  database: {
    connectionPoolSize: 20,
    maxRetries: 10,
    timeout: 10000
  },
  api: {
    apiTimeout: 20000,
    maxRetries: 10,
    rateLimit: {
      requests: 100,
      windowMs: 60000
    },
    cors: {
      origin: ['https://frauddetection.com', 'https://app.frauddetection.com'],
      credentials: true
    }
  },
  security: {
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 5 * 60 * 1000,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    passwordPolicy: {
      minLength: 12, // Strict in production
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    },
    deviceTracking: true,
    locationTracking: true, // Enabled in production for security
    allowMultipleSessions: false,
    csrfProtection: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  },
  features: {
    enableRealTimeUpdates: true,
    enableAdvancedAnalytics: true,
    enableAuditLogs: true,
    enableNotifications: true,
    enableSessionManagement: true,
    enableDeviceTracking: true,
    enableLocationServices: true,
    enableBatchProcessing: true,
    enableAutoSave: true,
    enableThemeToggle: false, // Disabled in production for consistency
    enableBetaFeatures: false,
    maintenanceMode: false
  },
  monitoring: {
    enableAnalytics: true,
    enableErrorReporting: true,
    enablePerformanceMonitoring: true,
    logLevel: 'error', // Only errors in production logs
    enableConsoleLogging: false,
    enableRemoteLogging: true
  },
  ui: {
    theme: 'dark',
    language: 'en',
    dateFormat: 'MM/dd/yyyy',
    timezone: 'America/New_York',
    itemsPerPage: 50,
    animationSpeed: 'fast', // Faster for performance
    enableAnimations: false, // Disabled for performance
    compactMode: true // Compact mode for efficiency
  }
}

const testConfig: EnvironmentConfig = {
  environment: 'test',
  debug: true,
  database: {
    connectionPoolSize: 2,
    maxRetries: 1,
    timeout: 3000
  },
  api: {
    apiTimeout: 5000,
    maxRetries: 1,
    rateLimit: {
      requests: 10000, // High limit for tests
      windowMs: 1000
    },
    cors: {
      origin: ['*'],
      credentials: false
    }
  },
  security: {
    sessionTimeout: 5 * 60 * 1000, // 5 minutes for tests
    warningTime: 1 * 60 * 1000,
    maxLoginAttempts: 100, // High for tests
    lockoutDuration: 1000, // 1 second
    passwordPolicy: {
      minLength: 1, // Minimal for tests
      requireUppercase: false,
      requireLowercase: false,
      requireNumbers: false,
      requireSpecialChars: false
    },
    deviceTracking: false,
    locationTracking: false,
    allowMultipleSessions: true,
    csrfProtection: false,
    contentSecurityPolicy: "default-src *"
  },
  features: {
    enableRealTimeUpdates: false, // Disabled for predictable tests
    enableAdvancedAnalytics: false,
    enableAuditLogs: true,
    enableNotifications: false, // Disabled to avoid interference
    enableSessionManagement: false,
    enableDeviceTracking: false,
    enableLocationServices: false,
    enableBatchProcessing: false,
    enableAutoSave: false,
    enableThemeToggle: false,
    enableBetaFeatures: false,
    maintenanceMode: false
  },
  monitoring: {
    enableAnalytics: false,
    enableErrorReporting: false,
    enablePerformanceMonitoring: false,
    logLevel: 'debug',
    enableConsoleLogging: true,
    enableRemoteLogging: false
  },
  ui: {
    theme: 'light',
    language: 'en',
    dateFormat: 'MM/dd/yyyy',
    timezone: 'UTC',
    itemsPerPage: 10,
    animationSpeed: 'fast',
    enableAnimations: false, // Disabled for tests
    compactMode: false
  }
}

// Get environment from various sources
function getEnvironment(): Environment {
  // Check Vite environment variable
  if (import.meta.env.VITE_ENVIRONMENT) {
    return import.meta.env.VITE_ENVIRONMENT as Environment
  }

  // Check NODE_ENV
  if (import.meta.env.NODE_ENV === 'production') {
    return 'production'
  }

  if (import.meta.env.NODE_ENV === 'test') {
    return 'test'
  }

  // Check hostname for staging
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname.includes('staging')) {
      return 'staging'
    }
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      return 'development'
    }
  }

  return 'development'
}

// Base configuration with required values
const baseConfig: AppConfig = {
  environment: getEnvironment(),
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  buildNumber: import.meta.env.VITE_BUILD_NUMBER || Date.now().toString(),
  database: {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    supabaseServiceKey: import.meta.env.VITE_SUPABASE_SERVICE_KEY
  },
  api: {
    fraudDetectionEndpoint: import.meta.env.VITE_FRAUD_API_ENDPOINT || 'http://localhost:8000',
    apiTimeout: 15000,
    maxRetries: 5,
    rateLimit: {
      requests: 100,
      windowMs: 60000
    },
    cors: {
      origin: ['*'],
      credentials: true
    }
  },
  security: {
    sessionTimeout: 30 * 60 * 1000,
    warningTime: 5 * 60 * 1000,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    },
    deviceTracking: true,
    locationTracking: false,
    allowMultipleSessions: false,
    csrfProtection: true,
    contentSecurityPolicy: "default-src 'self'"
  },
  features: {
    enableRealTimeUpdates: true,
    enableAdvancedAnalytics: true,
    enableAuditLogs: true,
    enableNotifications: true,
    enableSessionManagement: true,
    enableDeviceTracking: true,
    enableLocationServices: false,
    enableBatchProcessing: true,
    enableAutoSave: true,
    enableThemeToggle: true,
    enableBetaFeatures: false,
    maintenanceMode: false
  },
  monitoring: {
    enableAnalytics: false,
    enableErrorReporting: true,
    enablePerformanceMonitoring: false,
    logLevel: 'info',
    enableConsoleLogging: true,
    enableRemoteLogging: false
  },
  ui: {
    theme: 'dark',
    language: 'en',
    dateFormat: 'MM/dd/yyyy',
    timezone: 'America/New_York',
    itemsPerPage: 25,
    animationSpeed: 'normal',
    enableAnimations: true,
    compactMode: false
  },
  debug: false
}

// Merge environment-specific config with base config
function createConfig(): AppConfig {
  const env = getEnvironment()
  let envConfig: EnvironmentConfig

  switch (env) {
    case 'production':
      envConfig = productionConfig
      break
    case 'staging':
      envConfig = stagingConfig
      break
    case 'test':
      envConfig = testConfig
      break
    default:
      envConfig = developmentConfig
  }

  // Deep merge configuration
  return {
    ...baseConfig,
    environment: envConfig.environment || baseConfig.environment,
    version: envConfig.version || baseConfig.version,
    buildNumber: envConfig.buildNumber || baseConfig.buildNumber,
    debug: envConfig.debug !== undefined ? envConfig.debug : baseConfig.debug,
    database: { ...baseConfig.database, ...envConfig.database },
    api: {
      ...baseConfig.api,
      ...envConfig.api,
      rateLimit: { ...baseConfig.api.rateLimit, ...envConfig.api?.rateLimit },
      cors: { ...baseConfig.api.cors, ...envConfig.api?.cors }
    },
    security: {
      ...baseConfig.security,
      ...envConfig.security,
      passwordPolicy: { ...baseConfig.security.passwordPolicy, ...envConfig.security?.passwordPolicy }
    },
    features: { ...baseConfig.features, ...envConfig.features },
    monitoring: { ...baseConfig.monitoring, ...envConfig.monitoring },
    ui: { ...baseConfig.ui, ...envConfig.ui }
  }
}

// Validate configuration
function validateConfig(config: AppConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate required database configuration
  if (!config.database.supabaseUrl) {
    errors.push('VITE_SUPABASE_URL environment variable is required')
  }

  if (!config.database.supabaseAnonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY environment variable is required')
  }

  // Validate URL format
  try {
    new URL(config.database.supabaseUrl)
  } catch {
    errors.push('VITE_SUPABASE_URL must be a valid URL')
  }

  try {
    new URL(config.api.fraudDetectionEndpoint)
  } catch {
    errors.push('VITE_FRAUD_API_ENDPOINT must be a valid URL')
  }

  // Validate security configuration
  if (config.security.sessionTimeout < 60000) { // Less than 1 minute
    errors.push('Session timeout must be at least 1 minute')
  }

  if (config.security.maxLoginAttempts < 1) {
    errors.push('Max login attempts must be at least 1')
  }

  // Validate feature flags dependencies
  if (config.features.enableSessionManagement && config.security.sessionTimeout < 60000) {
    errors.push('Session management requires session timeout of at least 1 minute')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Create and validate configuration
export const config = createConfig()
export const configValidation = validateConfig(config)

// Environment detection helpers
export const isDevelopment = config.environment === 'development'
export const isStaging = config.environment === 'staging'
export const isProduction = config.environment === 'production'
export const isTest = config.environment === 'test'

// Feature flag helpers
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
  return config.features[feature]
}

// Configuration getter with type safety
export function getConfig<T extends keyof AppConfig>(key: T): AppConfig[T] {
  return config[key]
}

// Dynamic configuration updates (for runtime feature flag changes)
export function updateFeatureFlag(flag: keyof FeatureFlags, value: boolean): void {
  config.features[flag] = value

  // Persist to localStorage for user preferences
  try {
    const userPrefs = JSON.parse(localStorage.getItem('user_feature_preferences') || '{}')
    userPrefs[flag] = value
    localStorage.setItem('user_feature_preferences', JSON.stringify(userPrefs))
  } catch (error) {
    console.warn('Failed to save feature preference:', error)
  }
}

// Load user feature preferences
export function loadUserPreferences(): void {
  try {
    const userPrefs = JSON.parse(localStorage.getItem('user_feature_preferences') || '{}')
    Object.entries(userPrefs).forEach(([key, value]) => {
      if (key in config.features && typeof value === 'boolean') {
        config.features[key as keyof FeatureFlags] = value
      }
    })
  } catch (error) {
    console.warn('Failed to load user preferences:', error)
  }
}

// Configuration debugging
export function logConfiguration(): void {
  if (config.debug || isDevelopment) {
    console.group('Fraud Detection System Configuration')
    console.log('Environment:', config.environment)
    console.log('Version:', config.version)
    console.log('Build:', config.buildNumber)
    console.log('Debug Mode:', config.debug)
    console.log('Database URL:', config.database.supabaseUrl.replace(/\/\/.*@/, '//***@'))
    console.log('API Endpoint:', config.api.fraudDetectionEndpoint)
    console.log('Feature Flags:', config.features)
    console.log('Security Config:', {
      ...config.security,
      passwordPolicy: config.security.passwordPolicy
    })
    console.log('Validation:', configValidation)
    console.groupEnd()
  }
}

// Initialize configuration logging
if (typeof window !== 'undefined' && config.monitoring.enableConsoleLogging) {
  logConfiguration()
}

// Export validation result
if (!configValidation.isValid) {
  console.error('Configuration validation failed:', configValidation.errors)
  if (isProduction) {
    throw new Error('Invalid configuration in production environment')
  }
} else {
  console.log('Configuration validation passed')
}
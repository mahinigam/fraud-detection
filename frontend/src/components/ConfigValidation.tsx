import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Settings, 
  Database, 
  Shield,
  Monitor,
  Palette,
  Code,
  RefreshCw
} from 'lucide-react'
import { config, configValidation, isFeatureEnabled, isDevelopment, isProduction } from '../config/environment'

interface ConfigValidationProps {
  isOpen: boolean
  onClose: () => void
}

export const ConfigValidationModal: React.FC<ConfigValidationProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'validation' | 'database' | 'security' | 'features' | 'monitoring'>('validation')
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const tabs = [
    { id: 'validation', label: 'Validation', icon: CheckCircle },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'features', label: 'Features', icon: Settings },
    { id: 'monitoring', label: 'Monitoring', icon: Monitor }
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        key={refreshKey}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="glass-panel w-full max-w-4xl max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Code className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">System Configuration</h2>
                <p className="text-white/60">Environment: {config.environment} • Version: {config.version}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <AnimatePresence mode="wait">
            {activeTab === 'validation' && (
              <ValidationTab key="validation" />
            )}
            {activeTab === 'database' && (
              <DatabaseTab key="database" />
            )}
            {activeTab === 'security' && (
              <SecurityTab key="security" />
            )}
            {activeTab === 'features' && (
              <FeaturesTab key="features" />
            )}
            {activeTab === 'monitoring' && (
              <MonitoringTab key="monitoring" />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

// Validation Tab Component
const ValidationTab: React.FC = () => {
  const getStatusIcon = (isValid: boolean) => {
    return isValid ? (
      <CheckCircle className="w-5 h-5 text-green-400" />
    ) : (
      <XCircle className="w-5 h-5 text-red-400" />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3 mb-6">
        {getStatusIcon(configValidation.isValid)}
        <h3 className="text-xl font-semibold text-white">
          Configuration {configValidation.isValid ? 'Valid' : 'Invalid'}
        </h3>
      </div>

      {configValidation.errors.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-lg font-medium text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Configuration Errors
          </h4>
          {configValidation.errors.map((error, index) => (
            <div key={index} className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-300">{error}</p>
            </div>
          ))}
        </div>
      )}

      {configValidation.isValid && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-green-300">✅ All configuration checks passed successfully</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white/5 rounded-lg">
          <h4 className="font-medium text-white mb-2">Environment</h4>
          <p className="text-white/70">{config.environment}</p>
        </div>
        <div className="p-4 bg-white/5 rounded-lg">
          <h4 className="font-medium text-white mb-2">Debug Mode</h4>
          <p className="text-white/70">{config.debug ? 'Enabled' : 'Disabled'}</p>
        </div>
        <div className="p-4 bg-white/5 rounded-lg">
          <h4 className="font-medium text-white mb-2">Version</h4>
          <p className="text-white/70">{config.version}</p>
        </div>
        <div className="p-4 bg-white/5 rounded-lg">
          <h4 className="font-medium text-white mb-2">Build</h4>
          <p className="text-white/70">{config.buildNumber}</p>
        </div>
      </div>
    </motion.div>
  )
}

// Database Tab Component
const DatabaseTab: React.FC = () => {
  const maskUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return `${urlObj.protocol}//${urlObj.hostname}***`
    } catch {
      return 'Invalid URL'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <h3 className="text-xl font-semibold text-white flex items-center gap-2">
        <Database className="w-5 h-5 text-blue-400" />
        Database Configuration
      </h3>

      <div className="grid gap-4">
        <div className="p-4 bg-white/5 rounded-lg">
          <h4 className="font-medium text-white mb-2">Supabase URL</h4>
          <p className="text-white/70 font-mono text-sm">{maskUrl(config.database.supabaseUrl)}</p>
          <div className="flex items-center gap-2 mt-2">
            {config.database.supabaseUrl ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
            <span className="text-sm text-white/60">
              {config.database.supabaseUrl ? 'Configured' : 'Missing'}
            </span>
          </div>
        </div>

        <div className="p-4 bg-white/5 rounded-lg">
          <h4 className="font-medium text-white mb-2">Anonymous Key</h4>
          <p className="text-white/70 font-mono text-sm">
            {config.database.supabaseAnonKey ? `${config.database.supabaseAnonKey.substring(0, 10)}...` : 'Not configured'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {config.database.supabaseAnonKey ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
            <span className="text-sm text-white/60">
              {config.database.supabaseAnonKey ? 'Configured' : 'Missing'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Pool Size</h4>
            <p className="text-white/70">{config.database.connectionPoolSize || 'Default'}</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Max Retries</h4>
            <p className="text-white/70">{config.database.maxRetries || 'Default'}</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Timeout</h4>
            <p className="text-white/70">{config.database.timeout ? `${config.database.timeout}ms` : 'Default'}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Security Tab Component
const SecurityTab: React.FC = () => {
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <h3 className="text-xl font-semibold text-white flex items-center gap-2">
        <Shield className="w-5 h-5 text-green-400" />
        Security Configuration
      </h3>

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Session Timeout</h4>
            <p className="text-white/70">{formatDuration(config.security.sessionTimeout)}</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Warning Time</h4>
            <p className="text-white/70">{formatDuration(config.security.warningTime)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Max Login Attempts</h4>
            <p className="text-white/70">{config.security.maxLoginAttempts}</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Lockout Duration</h4>
            <p className="text-white/70">{formatDuration(config.security.lockoutDuration)}</p>
          </div>
        </div>

        <div className="p-4 bg-white/5 rounded-lg">
          <h4 className="font-medium text-white mb-3">Password Policy</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              {config.security.passwordPolicy.minLength >= 8 ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
              )}
              <span className="text-sm text-white/70">Min Length: {config.security.passwordPolicy.minLength}</span>
            </div>
            <div className="flex items-center gap-2">
              {config.security.passwordPolicy.requireUppercase ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-sm text-white/70">Uppercase Required</span>
            </div>
            <div className="flex items-center gap-2">
              {config.security.passwordPolicy.requireNumbers ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-sm text-white/70">Numbers Required</span>
            </div>
            <div className="flex items-center gap-2">
              {config.security.passwordPolicy.requireSpecialChars ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-sm text-white/70">Special Chars Required</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Device Tracking</h4>
            <div className="flex items-center gap-2">
              {config.security.deviceTracking ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-white/70">{config.security.deviceTracking ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">CSRF Protection</h4>
            <div className="flex items-center gap-2">
              {config.security.csrfProtection ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-white/70">{config.security.csrfProtection ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Features Tab Component
const FeaturesTab: React.FC = () => {
  const features = [
    { key: 'enableRealTimeUpdates', label: 'Real-time Updates', description: 'WebSocket connections for live updates' },
    { key: 'enableAdvancedAnalytics', label: 'Advanced Analytics', description: 'Enhanced fraud detection analytics' },
    { key: 'enableAuditLogs', label: 'Audit Logging', description: 'Comprehensive audit trail system' },
    { key: 'enableNotifications', label: 'Notifications', description: 'Toast notifications and alerts' },
    { key: 'enableSessionManagement', label: 'Session Management', description: 'Session timeout and security' },
    { key: 'enableDeviceTracking', label: 'Device Tracking', description: 'Device fingerprinting for security' },
    { key: 'enableLocationServices', label: 'Location Services', description: 'Geographic location tracking' },
    { key: 'enableBatchProcessing', label: 'Batch Processing', description: 'Bulk transaction processing' },
    { key: 'enableAutoSave', label: 'Auto Save', description: 'Automatic form data saving' },
    { key: 'enableThemeToggle', label: 'Theme Toggle', description: 'Light/dark theme switching' },
    { key: 'enableBetaFeatures', label: 'Beta Features', description: 'Experimental functionality' },
    { key: 'maintenanceMode', label: 'Maintenance Mode', description: 'System maintenance mode' }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <h3 className="text-xl font-semibold text-white flex items-center gap-2">
        <Settings className="w-5 h-5 text-purple-400" />
        Feature Flags
      </h3>

      <div className="grid gap-3">
        {features.map((feature) => {
          const isEnabled = isFeatureEnabled(feature.key as any)
          return (
            <div key={feature.key} className="p-4 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    {isEnabled ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                    <h4 className="font-medium text-white">{feature.label}</h4>
                  </div>
                  <p className="text-sm text-white/60 mt-1">{feature.description}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  isEnabled 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// Monitoring Tab Component
const MonitoringTab: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <h3 className="text-xl font-semibold text-white flex items-center gap-2">
        <Monitor className="w-5 h-5 text-orange-400" />
        Monitoring Configuration
      </h3>

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Analytics</h4>
            <div className="flex items-center gap-2">
              {config.monitoring.enableAnalytics ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-white/70">{config.monitoring.enableAnalytics ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Error Reporting</h4>
            <div className="flex items-center gap-2">
              {config.monitoring.enableErrorReporting ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-white/70">{config.monitoring.enableErrorReporting ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Performance Monitoring</h4>
            <div className="flex items-center gap-2">
              {config.monitoring.enablePerformanceMonitoring ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-white/70">{config.monitoring.enablePerformanceMonitoring ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Log Level</h4>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              config.monitoring.logLevel === 'error' ? 'bg-red-500/20 text-red-400' :
              config.monitoring.logLevel === 'warn' ? 'bg-yellow-500/20 text-yellow-400' :
              config.monitoring.logLevel === 'info' ? 'bg-blue-500/20 text-blue-400' :
              'bg-purple-500/20 text-purple-400'
            }`}>
              {config.monitoring.logLevel.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Console Logging</h4>
            <div className="flex items-center gap-2">
              {config.monitoring.enableConsoleLogging ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-white/70">{config.monitoring.enableConsoleLogging ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="font-medium text-white mb-2">Remote Logging</h4>
            <div className="flex items-center gap-2">
              {config.monitoring.enableRemoteLogging ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-white/70">{config.monitoring.enableRemoteLogging ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </div>

        {(isDevelopment || !isProduction) && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h4 className="font-medium text-yellow-400">Development Mode</h4>
            </div>
            <p className="text-yellow-300 text-sm">
              Some monitoring features may be disabled or configured differently in non-production environments.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default ConfigValidationModal
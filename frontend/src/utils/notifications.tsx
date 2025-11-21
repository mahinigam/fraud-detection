import React from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Info, 
  Clock,
  Shield,
  User,
  Activity
} from 'lucide-react'

export interface NotificationOptions {
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  dismissible?: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

// Icon mapping for notification types
const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info
}

// Color schemes for notification types
const colorSchemes = {
  success: {
    icon: 'text-green-400',
    border: 'border-green-500/30',
    bg: 'bg-green-500/10'
  },
  error: {
    icon: 'text-red-400',
    border: 'border-red-500/30', 
    bg: 'bg-red-500/10'
  },
  warning: {
    icon: 'text-yellow-400',
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/10'
  },
  info: {
    icon: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10'
  }
}

class NotificationService {
  private static instance: NotificationService

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  private createToastContent(
    message: string, 
    type: 'success' | 'error' | 'warning' | 'info',
    action?: { label: string; onClick: () => void }
  ) {
    const Icon = iconMap[type]
    const colors = colorSchemes[type]

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`
          flex items-center space-x-3 p-3 rounded-lg border backdrop-blur-16
          ${colors.bg} ${colors.border}
          bg-opacity-80 backdrop-filter
        `}
      >
        <Icon className={`w-5 h-5 ${colors.icon} flex-shrink-0`} />
        <div className="flex-1">
          <p className="text-white text-sm font-medium">{message}</p>
        </div>
        {action && (
          <button
            onClick={() => {
              action.onClick()
              toast.dismiss()
            }}
            className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors text-white"
          >
            {action.label}
          </button>
        )}
      </motion.div>
    )
  }

  show(message: string, options: NotificationOptions = {}) {
    const {
      type = 'info',
      duration = 4000,
      position = 'top-right',
      dismissible = true,
      action
    } = options

    return toast.custom(
      (t) => this.createToastContent(message, type, action),
      {
        duration,
        position,
        id: `notification-${Date.now()}`,
      }
    )
  }

  success(message: string, options?: Omit<NotificationOptions, 'type'>) {
    return this.show(message, { ...options, type: 'success' })
  }

  error(message: string, options?: Omit<NotificationOptions, 'type'>) {
    return this.show(message, { ...options, type: 'error' })
  }

  warning(message: string, options?: Omit<NotificationOptions, 'type'>) {
    return this.show(message, { ...options, type: 'warning' })
  }

  info(message: string, options?: Omit<NotificationOptions, 'type'>) {
    return this.show(message, { ...options, type: 'info' })
  }

  // Authentication notifications
  loginSuccess(userRole: string) {
    this.success(`Welcome back! Logged in as ${userRole}`, {
      duration: 3000
    })
  }

  loginError(message: string) {
    this.error(`Login failed: ${message}`, {
      duration: 5000,
      action: {
        label: 'Try Again',
        onClick: () => window.location.reload()
      }
    })
  }

  logoutSuccess() {
    this.info('You have been logged out successfully', {
      duration: 2000
    })
  }

  // Job notifications
  jobStarted(transactionId: string) {
    this.info(`Fraud analysis started for transaction ${transactionId.slice(-8)}`, {
      duration: 3000
    })
  }

  jobProgress(progress: number) {
    if (progress === 25 || progress === 50 || progress === 75) {
      this.info(`Analysis ${progress}% complete`, {
        duration: 2000
      })
    }
  }

  jobCompleted(riskScore: number, isFraud: boolean) {
    const message = isFraud 
      ? `⚠️ FRAUD DETECTED - Risk Score: ${riskScore}%`
      : `✅ Transaction Legitimate - Risk Score: ${riskScore}%`
    
    const type = isFraud ? 'warning' : 'success'
    
    this.show(message, {
      type,
      duration: 6000,
      action: {
        label: 'View Details',
        onClick: () => {
          // Could scroll to results or open modal
          document.querySelector('.result-panel')?.scrollIntoView({ behavior: 'smooth' })
        }
      }
    })
  }

  jobFailed(error: string) {
    this.error(`Analysis failed: ${error}`, {
      duration: 5000,
      action: {
        label: 'Retry',
        onClick: () => {
          // Could trigger retry logic
          window.location.reload()
        }
      }
    })
  }

  // Navigation notifications  
  navigationSuccess(pageName: string) {
    // Only show for major navigation changes
    if (['dashboard', 'analytics', 'reports'].includes(pageName)) {
      this.info(`Navigated to ${pageName}`, {
        duration: 2000
      })
    }
  }

  // Permission notifications
  permissionDenied(action: string) {
    this.warning(`Access denied: You don't have permission to ${action}`, {
      duration: 4000
    })
  }

  // System notifications
  systemError(message: string) {
    this.error(`System Error: ${message}`, {
      duration: 0, // Don't auto-dismiss system errors
      action: {
        label: 'Report Issue',
        onClick: () => {
          // Could open support form or email
          window.open('mailto:support@frauddetection.com?subject=System Error')
        }
      }
    })
  }

  connectionLost() {
    this.warning('Connection lost. Attempting to reconnect...', {
      duration: 0
    })
  }

  connectionRestored() {
    this.success('Connection restored', {
      duration: 2000
    })
  }

  // Session management notifications
  sessionWarning(minutesRemaining: number) {
    this.warning(`Your session will expire in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}. Extend session?`, {
      duration: 0, // Don't auto-dismiss
      action: {
        label: 'Extend Session',
        onClick: () => {
          // This would be handled by the session management hook
          window.dispatchEvent(new CustomEvent('extendSession'))
        }
      }
    })
  }

  sessionExpired() {
    this.error('Your session has expired. Please log in again.', {
      duration: 0 // Don't auto-dismiss
    })
  }

  sessionExtended() {
    this.success('Session extended successfully', {
      duration: 3000
    })
  }

  sessionExtensionFailed() {
    this.error('Failed to extend session. Please log in again.', {
      duration: 5000
    })
  }

  inactivityWarning() {
    this.warning('You have been logged out due to inactivity', {
      duration: 5000
    })
  }

  logoutInitiated() {
    this.info('Logging you out...', {
      duration: 2000
    })
  }

  // Batch operations
  dismiss(id?: string) {
    if (id) {
      toast.dismiss(id)
    } else {
      toast.dismiss()
    }
  }

  clear() {
    toast.dismiss()
  }
}

// Export singleton instance
export const notifications = NotificationService.getInstance()

// React hook for notifications
export const useNotifications = () => {
  return notifications
}

// Predefined notification templates
export const NotificationTemplates = {
  AUTH: {
    WELCOME: (role: string) => `Welcome! You're logged in as ${role}`,
    LOGOUT: 'Successfully logged out',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    INVALID_CREDENTIALS: 'Invalid email or password'
  },
  
  FRAUD_ANALYSIS: {
    STARTED: (id: string) => `Analysis started for transaction ${id}`,
    PROCESSING: (progress: number) => `Analysis ${progress}% complete`,
    COMPLETED_SAFE: (score: number) => `✅ Transaction appears legitimate (${score}% risk)`,
    COMPLETED_FRAUD: (score: number) => `⚠️ Potential fraud detected (${score}% risk)`,
    FAILED: (error: string) => `Analysis failed: ${error}`
  },
  
  SYSTEM: {
    SAVING: 'Saving changes...',
    SAVED: 'Changes saved successfully',
    ERROR: (message: string) => `Error: ${message}`,
    LOADING: 'Loading...',
    OFFLINE: 'You are currently offline',
    ONLINE: 'Connection restored'
  }
}
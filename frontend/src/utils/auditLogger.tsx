import React from 'react'
import { createAuditLog } from '../lib/supabase'

export interface AuditEvent {
  action: string
  resourceType: string
  resourceId: string
  details?: Record<string, any>
  userId?: string
}

// Common audit actions
export const AUDIT_ACTIONS = {
  // Authentication
  LOGIN: 'user_login',
  LOGOUT: 'user_logout',
  LOGIN_FAILED: 'login_failed',
  SESSION_EXPIRED: 'session_expired',
  
  // Navigation
  NAVIGATE: 'navigation',
  PAGE_VIEW: 'page_view',
  
  // Fraud Detection
  FRAUD_ANALYSIS_START: 'fraud_analysis_start',
  FRAUD_ANALYSIS_COMPLETE: 'fraud_analysis_complete',
  FRAUD_ANALYSIS_ERROR: 'fraud_analysis_error',
  
  // Data Operations
  DATA_CREATE: 'data_create',
  DATA_READ: 'data_read',
  DATA_UPDATE: 'data_update',
  DATA_DELETE: 'data_delete',
  DATA_EXPORT: 'data_export',
  
  // Admin Actions
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  USER_ROLE_CHANGE: 'user_role_change',
  
  // System Events
  SYSTEM_ERROR: 'system_error',
  PERMISSION_DENIED: 'permission_denied',
  SETTINGS_CHANGE: 'settings_change'
} as const

// Resource types
export const RESOURCE_TYPES = {
  USER: 'user',
  TRANSACTION: 'transaction',
  JOB: 'fraud_detection_job',
  AUTHENTICATION: 'authentication',
  UI_COMPONENT: 'ui_component',
  SYSTEM: 'system',
  SETTING: 'setting'
} as const

// Enhanced audit logger class
export class AuditLogger {
  private static instance: AuditLogger
  private userId: string | null = null
  
  private constructor() {}
  
  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }
  
  setUser(userId: string | null) {
    this.userId = userId
  }
  
  private getClientInfo() {
    return {
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer || undefined
    }
  }
  
  private async logEvent(event: AuditEvent): Promise<void> {
    try {
      const userId = event.userId || this.userId
      
      if (!userId) {
        console.warn('Audit log skipped: No user ID available')
        return
      }
      
      await createAuditLog({
        user_id: userId,
        action: event.action,
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        details: {
          ...event.details,
          ...this.getClientInfo()
        }
      })
    } catch (error) {
      console.error('Failed to create audit log:', error)
      // Don't throw - audit logging should not break application flow
    }
  }
  
  // Authentication events
  async logLogin(userId: string, method: string = 'email_password') {
    await this.logEvent({
      action: AUDIT_ACTIONS.LOGIN,
      resourceType: RESOURCE_TYPES.AUTHENTICATION,
      resourceId: userId,
      userId,
      details: {
        login_method: method
      }
    })
  }
  
  async logLogout(userId: string) {
    await this.logEvent({
      action: AUDIT_ACTIONS.LOGOUT,
      resourceType: RESOURCE_TYPES.AUTHENTICATION,
      resourceId: userId,
      userId,
      details: {
        logout_method: 'manual'
      }
    })
  }
  
  async logLoginFailed(email: string, reason: string) {
    await this.logEvent({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      resourceType: RESOURCE_TYPES.AUTHENTICATION,
      resourceId: email,
      details: {
        email,
        failure_reason: reason
      }
    })
  }
  
  // Navigation events
  async logNavigation(targetPage: string, userRole?: string) {
    await this.logEvent({
      action: AUDIT_ACTIONS.NAVIGATE,
      resourceType: RESOURCE_TYPES.UI_COMPONENT,
      resourceId: targetPage,
      details: {
        navigation_target: targetPage,
        user_role: userRole
      }
    })
  }
  
  // Fraud detection events
  async logFraudAnalysisStart(transactionId: string, jobId: string, inputData: any) {
    await this.logEvent({
      action: AUDIT_ACTIONS.FRAUD_ANALYSIS_START,
      resourceType: RESOURCE_TYPES.JOB,
      resourceId: jobId,
      details: {
        transaction_id: transactionId,
        input_data: inputData,
        analysis_type: 'fraud_detection'
      }
    })
  }
  
  async logFraudAnalysisComplete(jobId: string, result: any, processingTime: number) {
    await this.logEvent({
      action: AUDIT_ACTIONS.FRAUD_ANALYSIS_COMPLETE,
      resourceType: RESOURCE_TYPES.JOB,
      resourceId: jobId,
      details: {
        result: result,
        processing_time_ms: processingTime,
        status: 'completed'
      }
    })
  }
  
  async logFraudAnalysisError(jobId: string, error: string) {
    await this.logEvent({
      action: AUDIT_ACTIONS.FRAUD_ANALYSIS_ERROR,
      resourceType: RESOURCE_TYPES.JOB,
      resourceId: jobId,
      details: {
        error_message: error,
        status: 'failed'
      }
    })
  }
  
  // Data operations
  async logDataAccess(resourceType: string, resourceId: string, operation: 'read' | 'create' | 'update' | 'delete') {
    const actionMap = {
      read: AUDIT_ACTIONS.DATA_READ,
      create: AUDIT_ACTIONS.DATA_CREATE,
      update: AUDIT_ACTIONS.DATA_UPDATE,
      delete: AUDIT_ACTIONS.DATA_DELETE
    }
    
    await this.logEvent({
      action: actionMap[operation],
      resourceType,
      resourceId,
      details: {
        operation
      }
    })
  }
  
  // Permission events
  async logPermissionDenied(action: string, resourceType: string, userRole?: string) {
    await this.logEvent({
      action: AUDIT_ACTIONS.PERMISSION_DENIED,
      resourceType: RESOURCE_TYPES.SYSTEM,
      resourceId: 'permission_check',
      details: {
        denied_action: action,
        denied_resource: resourceType,
        user_role: userRole
      }
    })
  }
  
  // System events
  async logSystemError(error: string, component: string) {
    await this.logEvent({
      action: AUDIT_ACTIONS.SYSTEM_ERROR,
      resourceType: RESOURCE_TYPES.SYSTEM,
      resourceId: component,
      details: {
        error_message: error,
        component
      }
    })
  }
  
  // Admin events
  async logUserAction(targetUserId: string, action: 'create' | 'update' | 'delete', changes?: any) {
    const actionMap = {
      create: AUDIT_ACTIONS.USER_CREATE,
      update: AUDIT_ACTIONS.USER_UPDATE,
      delete: AUDIT_ACTIONS.USER_DELETE
    }
    
    await this.logEvent({
      action: actionMap[action],
      resourceType: RESOURCE_TYPES.USER,
      resourceId: targetUserId,
      details: {
        target_user_id: targetUserId,
        changes
      }
    })
  }
  
  // Session management events
  async logSessionActivity(activity: string, userRole: string, details?: any) {
    await this.logEvent({
      action: `session_${activity}`,
      resourceType: RESOURCE_TYPES.AUTHENTICATION,
      resourceId: this.userId || 'unknown',
      details: {
        session_activity: activity,
        user_role: userRole,
        ...details
      }
    })
  }

  async logSessionStart(userRole: string) {
    await this.logSessionActivity('started', userRole)
  }

  async logSessionEnd(userRole: string, reason: string = 'manual') {
    await this.logSessionActivity('ended', userRole, { end_reason: reason })
  }

  async logSessionTimeout(userRole: string) {
    await this.logSessionActivity('timeout', userRole)
  }

  async logSessionExtended(userRole: string) {
    await this.logSessionActivity('extended', userRole)
  }

  // Generic event logger
  async log(action: string, resourceType: string, resourceId: string, details?: any) {
    await this.logEvent({
      action,
      resourceType,
      resourceId,
      details
    })
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance()

// Convenience hooks for React components
export const useAuditLogger = () => {
  return auditLogger
}
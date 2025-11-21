import { motion } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import Sidebar from './components/Sidebar';
import TransactionForm from './components/TransactionForm';
import ResultPanel from './components/ResultPanel';
import JobProgressTracker from './components/JobProgressTracker';
import AdminDashboard from './components/AdminDashboard';
import { 
  withRouteProtection,
  AdminOnly,
  AnalystOrAdmin,
  usePermissionGuard,
  useNavigationGuard
} from './components/RouteProtection';
import { useSessionManagement, SessionWarningModal } from './hooks/useSessionManagement';
import { ConfigValidationModal } from './components/ConfigValidation';
import { config, isFeatureEnabled, configValidation, isDevelopment } from './config/environment';
import { createAuditLog, createFraudDetectionJob } from './lib/supabase';
import { auditLogger, useAuditLogger } from './utils/auditLogger';
import { notifications } from './utils/notifications';
import './index.css';

interface TransactionData {
  transactionId: string;
  amount: string;
  senderId: string;
  receiverId: string;
  transactionType: string;
  deviceId: string;
  geoLocation: string;
  timeOfTransaction: string;
  paymentMethod: string;
}

interface PredictionResult {
  prediction: number;
  risk_score: number;
}

function DashboardApp() {
  const { user, userProfile } = useAuth();
  const audit = useAuditLogger();
  const permissionGuard = usePermissionGuard();
  const navigationGuard = useNavigationGuard();
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | undefined>();
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Session management with configuration
  const {
    sessionInfo,
    extendSession,
    forceLogout
  } = useSessionManagement({
    sessionTimeout: config.security.sessionTimeout,
    warningTime: config.security.warningTime,
    extendOnActivity: true,
    trackUserActivity: isFeatureEnabled('enableSessionManagement')
  });

  // Set user context for audit logger
  useEffect(() => {
    if (user) {
      auditLogger.setUser(user.id);
    }
  }, [user]);

  // Configuration validation warning
  useEffect(() => {
    if (!configValidation.isValid) {
      notifications.error(`Configuration errors detected: ${configValidation.errors.length} issues found`);
      if (isDevelopment) {
        console.error('Configuration validation failed:', configValidation.errors);
      }
    }
  }, []);

  // Listen for session extension events
  useEffect(() => {
    const handleExtendSession = () => {
      extendSession();
    };

    window.addEventListener('extendSession', handleExtendSession);
    return () => {
      window.removeEventListener('extendSession', handleExtendSession);
    };
  }, [extendSession]);

  const handleTransactionSubmit = async (data: TransactionData) => {
    setLoading(true);
    const startTime = Date.now();
    let jobId: string | undefined;
    
    try {
      // Create fraud detection job for audit trail
      if (user && userProfile) {
        const jobResult = await createFraudDetectionJob({
          user_id: user.id,
          input_data: data
        });
        
        jobId = jobResult.data?.[0]?.id;
        setCurrentJobId(jobId);
        
        // Log analysis start
        if (jobId) {
          await audit.logFraudAnalysisStart(data.transactionId, jobId, data);
        }
      }

      // Transform the data to match the backend API format
      const apiData = {
        step: 1,
        type: data.transactionType,
        amount: parseFloat(data.amount),
        nameOrig: data.senderId,
        oldbalanceOrg: 0, // Default values - could be enhanced
        newbalanceOrig: 0,
        nameDest: data.receiverId,
        oldbalanceDest: 0,
        newbalanceDest: 0,
        isFlaggedFraud: 0
      };

      const response = await axios.post('http://localhost:8000/predict', apiData);
      setResult(response.data);
      
      // Log successful completion
      const processingTime = Date.now() - startTime;
      if (jobId) {
        await audit.logFraudAnalysisComplete(jobId, response.data, processingTime);
      }
      
    } catch (error) {
      console.error('Error:', error);
      
      // Log analysis error
      if (jobId) {
        await audit.logFraudAnalysisError(jobId, error instanceof Error ? error.message : 'Unknown error');
      }
      
      // Handle error appropriately
    } finally {
      setLoading(false);
    }
  };

  const handleNavigation = async (itemId: string) => {
    // Enhanced navigation security check
    if (!navigationGuard.canNavigateTo(`/${itemId}`)) {
      notifications.permissionDenied(`access the ${itemId} section`);
      auditLogger.logPermissionDenied('navigation', itemId, userProfile?.role || 'unknown');
      return;
    }

    // Permission check for admin dashboard
    if (itemId === 'admin-dashboard') {
      if (!permissionGuard.isAdmin()) {
        notifications.permissionDenied('access the admin dashboard');
        return;
      }
      setShowAdminDashboard(true);
      return;
    }

    // Permission check for system configuration
    if (itemId === 'system-config') {
      if (!permissionGuard.isAdmin()) {
        notifications.permissionDenied('access system configuration');
        return;
      }
      setShowConfigModal(true);
      return;
    }

    // Additional route-specific security checks
    const routeSecurityChecks = {
      'analytics': () => permissionGuard.canAccess(['admin', 'analyst', 'auditor']),
      'reports': () => permissionGuard.canAccess(['admin', 'analyst']),
      'settings': () => permissionGuard.canAccess(['admin']),
      'audit-logs': () => permissionGuard.canAccess(['admin', 'auditor'])
    };

    const securityCheck = routeSecurityChecks[itemId as keyof typeof routeSecurityChecks];
    if (securityCheck && !securityCheck()) {
      notifications.permissionDenied(`access the ${itemId} section`);
      auditLogger.logPermissionDenied('navigation', itemId, userProfile?.role || 'unknown');
      return;
    }
    
    // Log navigation using enhanced audit logger
    if (userProfile) {
      await audit.logNavigation(itemId, userProfile.role);
    }
    
    // Show navigation notification
    notifications.navigationSuccess(itemId);
    
    console.log('Navigate to:', itemId);
    
    // Provide user feedback with toast notifications
    const navigationMessages = {
      'dashboard': '📊 Navigating to Dashboard Overview',
      'transactions': '💳 Loading Transaction History', 
      'risk-scoring': '🛡️ Risk Scoring Analysis Active',
      'reports': '📈 Generating Reports Dashboard',
      'analytics': '📊 Opening Analytics Center',
      'settings': '⚙️ Accessing System Settings'
    };
    
    // Show navigation feedback (you can replace with actual routing)
    if (navigationMessages[itemId as keyof typeof navigationMessages]) {
      // For now just log, but you could show a toast notification
      console.log(navigationMessages[itemId as keyof typeof navigationMessages]);
    }
  };

  return (
    <motion.div 
      className="app-layout"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(255,255,255,0.1)',
            color: 'white',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }
        }}
      />
      
      <Sidebar onNavigate={handleNavigation} />
      
      {/* Transaction Form - Analyst and Admin Access */}
      <AnalystOrAdmin>
        <TransactionForm 
          onSubmit={handleTransactionSubmit}
          loading={loading}
        />
      </AnalystOrAdmin>
      
      <ResultPanel 
        result={result || undefined}
        loading={loading}
      />

      {/* Job Progress Tracker - Analyst and Admin Access */}
      <AnalystOrAdmin>
        <JobProgressTracker 
          jobId={currentJobId}
          onJobComplete={(result) => {
            setResult(result);
            setLoading(false);
          }}
          onJobError={(error) => {
            console.error('Job failed:', error);
            setLoading(false);
          }}
        />
      </AnalystOrAdmin>

      {/* Admin Dashboard Modal - Protected */}
      {showAdminDashboard && (
        <AdminOnly>
          <AdminDashboard onClose={() => setShowAdminDashboard(false)} />
        </AdminOnly>
      )}

      {/* Session Warning Modal */}
      <SessionWarningModal 
        isOpen={sessionInfo.shouldWarn && !sessionInfo.warningShown}
        timeRemaining={sessionInfo.timeRemaining}
        onExtend={extendSession}
        onLogout={() => forceLogout('user_choice')}
      />

      {/* System Configuration Modal - Admin Only */}
      {showConfigModal && (
        <AdminOnly>
          <ConfigValidationModal 
            isOpen={showConfigModal}
            onClose={() => setShowConfigModal(false)}
          />
        </AdminOnly>
      )}
    </motion.div>
  );
}

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="glass-panel p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-white/80">Initializing Fraud Detection System...</p>
        </div>
      </div>
    );
  }

  return user ? <DashboardApp /> : <LoginForm />;
}

export default function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

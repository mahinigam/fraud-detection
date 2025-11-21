import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Play, 
  Pause,
  RotateCcw,
  TrendingUp,
  Activity
} from 'lucide-react'
import { supabase, FraudDetectionJob, updateJobProgress } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { auditLogger } from '../utils/auditLogger'
import { notifications } from '../utils/notifications'

interface JobProgressTrackerProps {
  jobId?: string
  onJobComplete?: (result: any) => void
  onJobError?: (error: string) => void
}

// Job status configurations
const jobStatusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    label: 'Pending',
    description: 'Waiting to start analysis'
  },
  processing: {
    icon: Activity,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    label: 'Processing',
    description: 'Analyzing transaction data'
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    label: 'Completed',
    description: 'Analysis finished successfully'
  },
  failed: {
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    label: 'Failed',
    description: 'Analysis encountered an error'
  },
  cancelled: {
    icon: AlertCircle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20',
    label: 'Cancelled',
    description: 'Analysis was cancelled'
  }
}

export default function JobProgressTracker({ jobId, onJobComplete, onJobError }: JobProgressTrackerProps) {
  const { user, userProfile } = useAuth()
  const [jobs, setJobs] = useState<FraudDetectionJob[]>([])
  const [activeJob, setActiveJob] = useState<FraudDetectionJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<any>(null)

  // Load user's jobs
  useEffect(() => {
    if (user) {
      loadUserJobs()
    }
  }, [user])

  // Set up real-time subscriptions
  useEffect(() => {
    if (user) {
      setupRealtimeSubscription()
    }
    
    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [user])

  // Track specific job if provided
  useEffect(() => {
    if (jobId && jobs.length > 0) {
      const job = jobs.find(j => j.id === jobId)
      if (job) {
        setActiveJob(job)
        
        // Handle job completion
        if (job.status === 'completed' && job.result) {
          onJobComplete?.(job.result)
        } else if (job.status === 'failed') {
          onJobError?.(job.error_message || 'Job failed')
        }
      }
    }
  }, [jobId, jobs, onJobComplete, onJobError])

  const loadUserJobs = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('fraud_detection_jobs')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error loading jobs:', error)
        return
      }

      setJobs(data || [])
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('job-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fraud_detection_jobs',
          filter: `user_id=eq.${user!.id}`
        },
        (payload) => {
          handleJobUpdate(payload)
        }
      )
      .subscribe()

    setSubscription(channel)
  }

  const handleJobUpdate = (payload: any) => {
    const { eventType, new: newJob, old: oldJob } = payload

    setJobs(prevJobs => {
      let updatedJobs = [...prevJobs]

      switch (eventType) {
        case 'INSERT':
          updatedJobs = [newJob, ...updatedJobs]
          break
        
        case 'UPDATE':
          updatedJobs = updatedJobs.map(job => 
            job.id === newJob.id ? newJob : job
          )
          
          // Update active job if it's the one being tracked
          if (activeJob && activeJob.id === newJob.id) {
            setActiveJob(newJob)
            
            // Show progress notifications
            if (oldJob?.progress_percentage !== newJob?.progress_percentage) {
              notifications.jobProgress(newJob.progress_percentage)
            }
            
            // Show completion notifications
            if (oldJob?.status !== 'completed' && newJob?.status === 'completed' && newJob.result) {
              notifications.jobCompleted(
                Math.round(newJob.result.risk_score),
                newJob.result.prediction === 1
              )
            }
            
            // Show failure notifications
            if (oldJob?.status !== 'failed' && newJob?.status === 'failed') {
              notifications.jobFailed(newJob.error_message || 'Unknown error')
            }
          }
          break
        
        case 'DELETE':
          updatedJobs = updatedJobs.filter(job => job.id !== oldJob.id)
          break
      }

      return updatedJobs
    })

    // Log job status changes
    if (eventType === 'UPDATE' && oldJob?.status !== newJob?.status) {
      auditLogger.log(
        'job_status_change',
        'fraud_detection_job',
        newJob.id,
        {
          old_status: oldJob?.status,
          new_status: newJob?.status,
          progress: newJob?.progress_percentage
        }
      )
    }
  }

  const simulateJobProgress = async (job: FraudDetectionJob) => {
    if (job.status !== 'pending') return

    try {
      // Notify job started
      const transactionId = job.input_data?.transactionId || job.id
      notifications.jobStarted(transactionId)
      
      // Start the job
      await updateJobProgress(job.id, 0, 'processing')
      
      // Simulate progress updates
      const intervals = [10, 25, 40, 60, 75, 90, 100]
      
      for (let i = 0; i < intervals.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const progress = intervals[i]
        const status = progress === 100 ? 'completed' : 'processing'
        
        await updateJobProgress(job.id, progress, status)
        
        if (progress === 100) {
          // Simulate successful result
          const mockResult = {
            prediction: Math.random() > 0.7 ? 1 : 0,
            risk_score: Math.random() * 100,
            confidence: 0.85 + Math.random() * 0.15,
            factors: ['amount_anomaly', 'time_pattern', 'location_risk']
          }
          
          await supabase
            .from('fraud_detection_jobs')
            .update({ result: mockResult })
            .eq('id', job.id)
        }
      }
    } catch (error) {
      console.error('Error simulating job progress:', error)
      await updateJobProgress(job.id, 0, 'failed')
    }
  }

  const cancelJob = async (jobId: string) => {
    try {
      await updateJobProgress(jobId, 0, 'cancelled')
      
      await auditLogger.log(
        'job_cancelled',
        'fraud_detection_job',
        jobId,
        { cancelled_by_user: true }
      )
    } catch (error) {
      console.error('Error cancelling job:', error)
    }
  }

  const retryJob = async (job: FraudDetectionJob) => {
    try {
      await updateJobProgress(job.id, 0, 'pending')
      
      await auditLogger.log(
        'job_retry',
        'fraud_detection_job',
        job.id,
        { retried_from_status: job.status }
      )
      
      // Start the job again
      setTimeout(() => simulateJobProgress(job), 1000)
    } catch (error) {
      console.error('Error retrying job:', error)
    }
  }

  if (loading) {
    return (
      <div className="glass-panel p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-white/10 rounded w-1/3"></div>
          <div className="h-20 bg-white/5 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Active Job Tracker */}
      {activeJob && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6"
        >
          <JobProgressCard 
            job={activeJob} 
            onCancel={() => cancelJob(activeJob.id)}
            onRetry={() => retryJob(activeJob)}
            onSimulate={() => simulateJobProgress(activeJob)}
            isActive={true}
          />
        </motion.div>
      )}

      {/* Recent Jobs */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Recent Jobs</h3>
          <motion.button
            onClick={loadUserJobs}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-white/60 hover:text-white/80 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </motion.button>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {jobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
              >
                <JobProgressCard 
                  job={job} 
                  onCancel={() => cancelJob(job.id)}
                  onRetry={() => retryJob(job)}
                  onSimulate={() => simulateJobProgress(job)}
                  isActive={false}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {jobs.length === 0 && (
          <div className="text-center py-8 text-white/60">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No jobs found</p>
            <p className="text-sm">Submit a transaction to start fraud detection</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface JobProgressCardProps {
  job: FraudDetectionJob
  onCancel: () => void
  onRetry: () => void
  onSimulate: () => void
  isActive: boolean
}

function JobProgressCard({ job, onCancel, onRetry, onSimulate, isActive }: JobProgressCardProps) {
  const config = jobStatusConfig[job.status]
  const StatusIcon = config.icon

  return (
    <div className={`
      relative p-4 rounded-lg border transition-all duration-300
      ${isActive ? 'ring-2 ring-blue-500/50' : ''}
      ${config.bgColor} ${config.borderColor}
    `}>
      {/* Status Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${config.bgColor}`}>
            <StatusIcon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h4 className={`font-medium ${config.color}`}>{config.label}</h4>
            <p className="text-xs text-white/60">{config.description}</p>
          </div>
        </div>
        
        <div className="text-xs text-white/40">
          {new Date(job.created_at).toLocaleTimeString()}
        </div>
      </div>

      {/* Progress Bar */}
      {job.status === 'processing' && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/60">Progress</span>
            <span className="text-xs text-white/80">{job.progress_percentage}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${job.progress_percentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Job Details */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-white/60">Transaction ID:</span>
          <span className="text-white/80 font-mono">
            {job.input_data?.transactionId?.slice(-8) || 'N/A'}
          </span>
        </div>
        
        {job.input_data?.amount && (
          <div className="flex justify-between">
            <span className="text-white/60">Amount:</span>
            <span className="text-white/80">${job.input_data.amount}</span>
          </div>
        )}
        
        {job.processing_time_ms && (
          <div className="flex justify-between">
            <span className="text-white/60">Processing Time:</span>
            <span className="text-white/80">{job.processing_time_ms}ms</span>
          </div>
        )}
      </div>

      {/* Result Display */}
      {job.status === 'completed' && job.result && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-white/10"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white/80">
              Risk Score: {Math.round(job.result.risk_score)}%
            </span>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              job.result.prediction === 1 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-green-500/20 text-green-400'
            }`}>
              {job.result.prediction === 1 ? 'FRAUD' : 'LEGITIMATE'}
            </div>
          </div>
        </motion.div>
      )}

      {/* Error Display */}
      {job.status === 'failed' && job.error_message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-red-500/20"
        >
          <p className="text-xs text-red-400">{job.error_message}</p>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end space-x-2 mt-3">
        {job.status === 'pending' && (
          <motion.button
            onClick={onSimulate}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30 transition-colors"
          >
            <Play className="w-3 h-3 inline mr-1" />
            Start
          </motion.button>
        )}
        
        {job.status === 'processing' && (
          <motion.button
            onClick={onCancel}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 transition-colors"
          >
            <Pause className="w-3 h-3 inline mr-1" />
            Cancel
          </motion.button>
        )}
        
        {job.status === 'failed' && (
          <motion.button
            onClick={onRetry}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs hover:bg-yellow-500/30 transition-colors"
          >
            <RotateCcw className="w-3 h-3 inline mr-1" />
            Retry
          </motion.button>
        )}
      </div>
    </div>
  )
}
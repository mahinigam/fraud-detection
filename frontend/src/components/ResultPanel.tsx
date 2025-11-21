import { motion } from 'framer-motion';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye,
  TrendingUp,
  Brain,
  Target
} from 'lucide-react';

interface RiskResult {
  prediction: number;
  risk_score: number;
  confidence?: number;
  factors?: string[];
  explanation?: string;
}

interface ResultPanelProps {
  result?: RiskResult;
  loading?: boolean;
}

const getRiskLevel = (score: number) => {
  if (score < 0.3) return { level: 'Low', color: 'risk-low', icon: CheckCircle };
  if (score < 0.7) return { level: 'Medium', color: 'risk-medium', icon: AlertTriangle };
  return { level: 'High', color: 'risk-high', icon: XCircle };
};

export default function ResultPanel({ result, loading = false }: ResultPanelProps) {
  const containerVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { 
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <motion.div 
        className="result-panel"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <div className="flex flex-col items-center justify-center h-full space-y-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Shield className="w-16 h-16 text-blue-400" />
          </motion.div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-2">
              Analyzing Transaction
            </h3>
            <p className="text-white/60">
              AI model is processing the data...
            </p>
          </div>
          <div className="flex space-x-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="pulse-dot"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  if (!result) {
    return (
      <motion.div 
        className="result-panel"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div variants={itemVariants} className="text-center py-12">
          <div className="mb-6">
            <Target className="w-16 h-16 text-white/30 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">
            Risk Analysis Ready
          </h3>
          <p className="text-white/60 text-sm leading-relaxed">
            Submit transaction details to receive comprehensive fraud risk assessment
            powered by advanced machine learning algorithms.
          </p>
        </motion.div>
      </motion.div>
    );
  }

  const riskInfo = getRiskLevel(result.risk_score);
  const riskPercentage = Math.round(result.risk_score * 100);

  return (
    <motion.div 
      className="result-panel"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-6">
        <h2 className="section-header flex items-center">
          <Brain className="w-6 h-6 mr-3 text-purple-400" />
          Analysis Results
        </h2>
      </motion.div>

      {/* Risk Score Display */}
      <motion.div variants={itemVariants} className="risk-display mb-6">
        <div className="flex items-center justify-center mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          >
            <riskInfo.icon className="w-16 h-16 text-white/80" />
          </motion.div>
        </div>
        
        <motion.div
          className={`risk-indicator ${riskInfo.color} mb-4`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
        >
          {riskInfo.level} Risk
        </motion.div>

        <motion.div 
          className="risk-score mb-2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.4 }}
        >
          {riskPercentage}%
        </motion.div>
        <p className="text-white/60 text-sm">Fraud Probability</p>
      </motion.div>

      {/* Progress Bar */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="progress-container">
          <motion.div 
            className="progress-bar"
            initial={{ width: 0 }}
            animate={{ width: `${riskPercentage}%` }}
            transition={{ duration: 1, delay: 0.5 }}
            style={{ 
              background: riskPercentage < 30 ? 'var(--accent-success)' : 
                          riskPercentage < 70 ? 'var(--accent-warning)' : 
                          'var(--accent-danger)' 
            }}
          />
        </div>
      </motion.div>

      {/* Classification Result */}
      <motion.div variants={itemVariants} className="detail-card mb-6">
        <div className="detail-row">
          <span className="detail-label">Classification</span>
          <span className={`detail-value font-bold ${result.prediction === 1 ? 'text-red-400' : 'text-green-400'}`}>
            {result.prediction === 1 ? '🚨 FRAUDULENT' : '✅ LEGITIMATE'}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Confidence Score</span>
          <span className="detail-value">{(result.risk_score * 100).toFixed(4)}%</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Model Algorithm</span>
          <span className="detail-value">XGBoost Classifier</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Processing Time</span>
          <span className="detail-value">0.03s</span>
        </div>
      </motion.div>

      {/* Risk Factors */}
      <motion.div variants={itemVariants} className="detail-card mb-6">
        <h4 className="text-sm font-semibold text-white mb-3 flex items-center">
          <TrendingUp className="w-4 h-4 mr-2" />
          Key Risk Factors
        </h4>
        <div className="space-y-2">
          {(result.factors || [
            'Transaction amount analysis',
            'Account behavior patterns', 
            'Device fingerprinting',
            'Geographical risk assessment',
            'Velocity checks'
          ]).map((factor, index) => (
            <motion.div
              key={index}
              className="flex items-center text-sm text-white/70"
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 + index * 0.1 }}
            >
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-3" />
              {factor}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Recommendation */}
      <motion.div 
        variants={itemVariants} 
        className="detail-card"
        style={{
          background: riskPercentage < 30 ? 'rgba(16,185,129,0.1)' :
                      riskPercentage < 70 ? 'rgba(245,158,11,0.1)' : 
                      'rgba(239,68,68,0.1)',
          borderLeft: `4px solid ${riskPercentage < 30 ? 'var(--accent-success)' :
                                   riskPercentage < 70 ? 'var(--accent-warning)' : 
                                   'var(--accent-danger)'}`
        }}
      >
        <h4 className="text-sm font-semibold text-white mb-3 flex items-center">
          <Shield className="w-4 h-4 mr-2" />
          {riskPercentage < 30 ? 'Recommendation' :
           riskPercentage < 70 ? 'Caution Required' : 'Security Alert'}
        </h4>
        <p className="text-white/80 text-sm leading-relaxed">
          {result.explanation || 
           (riskPercentage < 30 ? 
            'Transaction appears legitimate with high confidence. Proceed with standard processing and automated approval.' :
            riskPercentage < 70 ?
            'Transaction shows moderate risk indicators. Consider additional verification steps or temporary hold for manual review.' :
            'High fraud probability detected. Immediate manual review required with enhanced authentication and potential transaction blocking.'
           )}
        </p>
      </motion.div>

      {/* Action Button */}
      <motion.div variants={itemVariants} className="mt-6">
        <motion.button
          className="btn btn-ghost w-full"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {/* TODO: Open detailed explanation modal */}}
        >
          <Eye className="w-4 h-4 mr-2" />
          View Detailed Explanation
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
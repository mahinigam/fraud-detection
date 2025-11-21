import React, { useState } from 'react';
import { AlertCircle, Shield, CheckCircle, AlertTriangle, X } from 'lucide-react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

interface TransactionForm {
  step: number;
  type: string;
  amount: number;
  nameOrig: string;
  oldbalanceOrg: number;
  newbalanceOrig: number;
  nameDest: string;
  oldbalanceDest: number;
  newbalanceDest: number;
  isFlaggedFraud: number;
}

interface PredictionResult {
  prediction: number;
  risk_score: number;
}

const TRANSACTION_TYPES = ['PAYMENT', 'TRANSFER', 'CASH_OUT', 'DEBIT', 'CASH_IN'];

const FraudDetectionApp: React.FC = () => {
  const [form, setForm] = useState<TransactionForm>({
    step: 1,
    type: 'PAYMENT',
    amount: 0,
    nameOrig: '',
    oldbalanceOrg: 0,
    newbalanceOrig: 0,
    nameDest: '',
    oldbalanceDest: 0,
    newbalanceDest: 0,
    isFlaggedFraud: 0,
  });

  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'type' ? value : Number(value)
    }));
  };

  const getRiskLevel = (score: number) => {
    if (score < 0.1) return { level: 'Low', color: 'risk-low', icon: CheckCircle };
    if (score < 0.5) return { level: 'Medium', color: 'risk-medium', icon: AlertTriangle };
    return { level: 'High', color: 'risk-high', icon: AlertCircle };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert form data to the expected format for the model
      const features = [
        form.step,
        TRANSACTION_TYPES.indexOf(form.type), // Convert type to numeric
        form.amount,
        form.nameOrig.length > 0 ? 1 : 0, // Simple encoding for demo
        form.oldbalanceOrg,
        form.newbalanceOrig,
        form.nameDest.length > 0 ? 1 : 0, // Simple encoding for demo
        form.oldbalanceDest,
        form.newbalanceDest,
        form.isFlaggedFraud
      ];

      const response = await axios.post<PredictionResult>('http://localhost:8000/predict', {
        features
      });

      setResult(response.data);
      setShowResult(true);
      toast.success('Fraud analysis completed!');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to analyze transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      step: 1,
      type: 'PAYMENT',
      amount: 0,
      nameOrig: '',
      oldbalanceOrg: 0,
      newbalanceOrig: 0,
      nameDest: '',
      oldbalanceDest: 0,
      newbalanceDest: 0,
      isFlaggedFraud: 0,
    });
    setResult(null);
    setShowResult(false);
  };

  const riskInfo = result ? getRiskLevel(result.risk_score) : null;

  return (
    <div className="app-shell">
      <Toaster position="top-right" />

      <div style={{ maxWidth: '64rem', width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <Shield style={{ height: '3rem', width: '3rem', color: '#ffffff', marginRight: '0.75rem' }} />
            <h1 className="glass-header" style={{ fontSize: '2.5rem', margin: 0 }}>Fraud Detection System</h1>
          </div>
          <p className="glass-muted" style={{ fontSize: '1.25rem' }}>
            AI-powered transaction fraud analysis using XGBoost
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem' }}>
          {/* Input Form */}
          <div className="glass-card">
            <h2 className="glass-header flex items-center mb-6">
              <AlertCircle style={{ height: '1.5rem', width: '1.5rem', color: '#ffffff', marginRight: '0.5rem' }} />
              Transaction Details
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Step
                  </label>
                  <input
                    type="number"
                    name="step"
                    value={form.step}
                    onChange={handleInputChange}
                    className="form-input"
                    min="1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Transaction Type
                  </label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                  >
                    {TRANSACTION_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Amount
                </label>
                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleInputChange}
                  className="form-input"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Origin Account
                  </label>
                  <input
                    type="text"
                    name="nameOrig"
                    value={form.nameOrig}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="e.g., C123456789"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Destination Account
                  </label>
                  <input
                    type="text"
                    name="nameDest"
                    value={form.nameDest}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="e.g., M987654321"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Origin Old Balance
                  </label>
                  <input
                    type="number"
                    name="oldbalanceOrg"
                    value={form.oldbalanceOrg}
                    onChange={handleInputChange}
                    className="form-input"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Origin New Balance
                  </label>
                  <input
                    type="number"
                    name="newbalanceOrig"
                    value={form.newbalanceOrig}
                    onChange={handleInputChange}
                    className="form-input"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Destination Old Balance
                  </label>
                  <input
                    type="number"
                    name="oldbalanceDest"
                    value={form.oldbalanceDest}
                    onChange={handleInputChange}
                    className="form-input"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Destination New Balance
                  </label>
                  <input
                    type="number"
                    name="newbalanceDest"
                    value={form.newbalanceDest}
                    onChange={handleInputChange}
                    className="form-input"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Flagged by System
                </label>
                <select
                  name="isFlaggedFraud"
                  value={form.isFlaggedFraud}
                  onChange={handleInputChange}
                  className="form-input"
                >
                  <option value={0}>No</option>
                  <option value={1}>Yes</option>
                </select>
              </div>

              <div className="flex" style={{ gap: '1rem', paddingTop: '1rem' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {loading ? (
                    <>
                      <span className="loading-spinner"></span>
                      Analyzing Transaction...
                    </>
                  ) : (
                    'Analyze Transaction'
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="btn"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>

          {/* Results Panel */}
          <div className="glass-card">
            <h2 className="glass-header flex items-center mb-6">
              <Shield style={{ height: '1.5rem', width: '1.5rem', color: '#ffffff', marginRight: '0.5rem' }} />
              Analysis Results
            </h2>

            {!showResult ? (
              <div className="flex items-center justify-center" style={{ height: '16rem', color: 'var(--muted)' }}>
                <div style={{ textAlign: 'center' }}>
                  <AlertCircle style={{ height: '4rem', width: '4rem', color: 'rgba(255,255,255,0.3)', margin: '0 auto 1rem' }} />
                  <p style={{ fontSize: '1.125rem' }}>Submit a transaction to see fraud analysis</p>
                </div>
              </div>
            ) : result && riskInfo ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Risk Score Display */}
                <div className="risk-display">
                  <div className="flex items-center justify-center mb-4">
                    <riskInfo.icon style={{ height: '4rem', width: '4rem', color: 'rgba(255,255,255,0.8)' }} />
                  </div>
                  <div className={`risk-indicator ${result.risk_score < 0.1 ? 'risk-low' :
                      result.risk_score < 0.5 ? 'risk-medium' : 'risk-high'
                    }`}>
                    {riskInfo.level} Risk
                  </div>
                  <div className="risk-score">
                    {(result.risk_score * 100).toFixed(2)}%
                  </div>
                  <p className="glass-muted">Fraud Probability</p>
                </div>

                {/* Animated Risk Progress Bar */}
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${result.risk_score < 0.1 ? 'progress-low' :
                        result.risk_score < 0.5 ? 'progress-medium' : 'progress-high'
                      }`}
                    style={{ width: `${Math.min(result.risk_score * 100, 100)}%` }}
                  ></div>
                </div>

                {/* Prediction Details */}
                <div className="details-panel">
                  <h3 className="glass-header" style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Prediction Details</h3>
                  <div>
                    <div className="detail-row">
                      <span className="detail-label">Classification:</span>
                      <span className={`detail-value ${result.prediction === 1 ? 'risk-high' : 'risk-low'}`} style={{ color: result.prediction === 1 ? 'rgba(255,69,58,1)' : 'rgba(52,199,89,1)' }}>
                        {result.prediction === 1 ? 'FRAUDULENT' : 'LEGITIMATE'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Confidence Score:</span>
                      <span className="detail-value">{(result.risk_score * 100).toFixed(4)}%</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Model Algorithm:</span>
                      <span className="detail-value">XGBoost Classifier</span>
                    </div>
                  </div>
                </div>

                {/* Enhanced Recommendations */}
                <div className={`details-panel ${result.risk_score < 0.1 ? 'risk-low' :
                    result.risk_score < 0.5 ? 'risk-medium' : 'risk-high'
                  }`} style={{
                    background: result.risk_score < 0.1 ? 'rgba(52,199,89,0.1)' :
                      result.risk_score < 0.5 ? 'rgba(255,149,0,0.1)' : 'rgba(255,69,58,0.1)',
                    borderLeft: `4px solid ${result.risk_score < 0.1 ? 'rgba(52,199,89,0.8)' :
                      result.risk_score < 0.5 ? 'rgba(255,149,0,0.8)' : 'rgba(255,69,58,0.8)'}`
                  }}>
                  <h4 className="glass-header" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
                    {result.risk_score < 0.1 ? 'Recommendation' :
                      result.risk_score < 0.5 ? 'Caution Required' : 'Security Alert'}
                  </h4>
                  <p className="glass-muted" style={{ lineHeight: '1.6' }}>
                    {result.risk_score < 0.1 ?
                      'Transaction appears legitimate with high confidence. Proceed with standard processing and automated approval.' :
                      result.risk_score < 0.5 ?
                        'Transaction shows moderate risk indicators. Consider additional verification steps or temporary hold for manual review.' :
                        'High fraud probability detected. Immediate manual review required with enhanced authentication and potential transaction blocking.'
                    }
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Model Information */}
        <div className="glass-card" style={{ marginTop: '2rem' }}>
          <h3 className="glass-header">Model Performance Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="glass" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div className="risk-score" style={{ fontSize: '2rem', margin: '0.5rem 0', color: 'rgba(0,122,255,1)' }}>99.95%</div>
              <div className="glass-muted">Model Accuracy (ROC-AUC)</div>
            </div>
            <div className="glass" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div className="risk-score" style={{ fontSize: '2rem', margin: '0.5rem 0', color: 'rgba(52,199,89,1)' }}>XGBoost</div>
              <div className="glass-muted">ML Algorithm</div>
            </div>
            <div className="glass" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div className="risk-score" style={{ fontSize: '2rem', margin: '0.5rem 0', color: 'rgba(255,149,0,1)' }}>6.3M+</div>
              <div className="glass-muted">Training Samples</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FraudDetectionApp;
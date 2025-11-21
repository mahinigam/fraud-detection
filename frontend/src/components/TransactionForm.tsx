import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  Play,
  RotateCcw,
  Upload,
  Zap,
  DollarSign,
  Clock,
  MapPin,
  Smartphone
} from 'lucide-react';

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

interface TransactionFormProps {
  onSubmit: (data: TransactionData) => void;
  loading?: boolean;
}

const transactionTypes = [
  'PAYMENT', 'TRANSFER', 'CASH_OUT', 'DEBIT', 'CASH_IN'
];

const paymentMethods = [
  'UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallet', 'Cash'
];

export default function TransactionForm({ onSubmit, loading = false }: TransactionFormProps) {
  const [formData, setFormData] = useState<TransactionData>({
    transactionId: '',
    amount: '',
    senderId: '',
    receiverId: '',
    transactionType: 'PAYMENT',
    deviceId: '',
    geoLocation: '',
    timeOfTransaction: '',
    paymentMethod: 'UPI'
  });

  const handleChange = (field: keyof TransactionData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleReset = () => {
    setFormData({
      transactionId: '',
      amount: '',
      senderId: '',
      receiverId: '',
      transactionType: 'PAYMENT',
      deviceId: '',
      geoLocation: '',
      timeOfTransaction: '',
      paymentMethod: 'UPI'
    });
  };

  const handleAutoFill = () => {
    setFormData({
      transactionId: `TXN${Date.now()}`,
      amount: '15000.00',
      senderId: 'C1234567890',
      receiverId: 'M9876543210',
      transactionType: 'TRANSFER',
      deviceId: 'DEV_MOBILE_001',
      geoLocation: '19.0760, 72.8777',
      timeOfTransaction: new Date().toISOString().slice(0, 16),
      paymentMethod: 'UPI'
    });
  };

  const formVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const fieldVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <div className="main-panel">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={formVariants}
      >
        {/* Header */}
        <motion.div variants={fieldVariants} className="form-section">
          <h2 className="section-header">
            <DollarSign className="inline-block w-6 h-6 mr-3 text-blue-400" />
            Transaction Details
          </h2>
          <p className="text-white/60 mb-8">
            Enter transaction information for fraud risk assessment
          </p>
        </motion.div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <motion.div variants={fieldVariants} className="form-grid">
            {/* Transaction ID */}
            <div className="form-field">
              <label className="field-label">Transaction ID</label>
              <input
                type="text"
                className="field-input"
                placeholder="Enter transaction ID"
                value={formData.transactionId}
                onChange={(e) => handleChange('transactionId', e.target.value)}
                required
              />
            </div>

            {/* Amount */}
            <div className="form-field">
              <label className="field-label">Amount (₹)</label>
              <input
                type="number"
                className="field-input"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                required
              />
            </div>

            {/* Sender ID */}
            <div className="form-field">
              <label className="field-label">Sender ID</label>
              <input
                type="text"
                className="field-input"
                placeholder="C123456789"
                value={formData.senderId}
                onChange={(e) => handleChange('senderId', e.target.value)}
                required
              />
            </div>

            {/* Receiver ID */}
            <div className="form-field">
              <label className="field-label">Receiver ID</label>
              <input
                type="text"
                className="field-input"
                placeholder="M987654321"
                value={formData.receiverId}
                onChange={(e) => handleChange('receiverId', e.target.value)}
                required
              />
            </div>

            {/* Transaction Type */}
            <div className="form-field">
              <label className="field-label">Transaction Type</label>
              <select
                className="field-input select-input"
                value={formData.transactionType}
                onChange={(e) => handleChange('transactionType', e.target.value)}
                required
              >
                {transactionTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div className="form-field">
              <label className="field-label">Payment Method</label>
              <select
                className="field-input select-input"
                value={formData.paymentMethod}
                onChange={(e) => handleChange('paymentMethod', e.target.value)}
                required
              >
                {paymentMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            {/* Device ID */}
            <div className="form-field">
              <label className="field-label">Device ID</label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  className="field-input pl-10"
                  placeholder="DEV_MOBILE_001"
                  value={formData.deviceId}
                  onChange={(e) => handleChange('deviceId', e.target.value)}
                />
              </div>
            </div>

            {/* Geo Location */}
            <div className="form-field">
              <label className="field-label">Geo Location (Optional)</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  className="field-input pl-10"
                  placeholder="19.0760, 72.8777"
                  value={formData.geoLocation}
                  onChange={(e) => handleChange('geoLocation', e.target.value)}
                />
              </div>
            </div>

            {/* Time of Transaction */}
            <div className="form-field col-span-2">
              <label className="field-label">Time of Transaction</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="datetime-local"
                  className="field-input pl-10"
                  value={formData.timeOfTransaction}
                  onChange={(e) => handleChange('timeOfTransaction', e.target.value)}
                  required
                />
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            variants={fieldVariants}
            className="btn-row"
          >
            <motion.button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Risk Score
                </>
              )}
            </motion.button>

            <motion.button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <RotateCcw className="w-4 h-4" />
              Reset Form
            </motion.button>

            <motion.button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    console.log('CSV file selected:', file.name);
                    // TODO: Implement CSV processing
                  }
                };
                input.click();
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Upload className="w-4 h-4" />
              Upload CSV
            </motion.button>

            <motion.button
              type="button"
              className="btn btn-ghost"
              onClick={handleAutoFill}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Zap className="w-4 h-4" />
              Auto-fill Demo
            </motion.button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
}
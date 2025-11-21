import { motion } from 'framer-motion';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';

import Sidebar from './components/Sidebar';
import TransactionForm from './components/TransactionForm';
import ResultPanel from './components/ResultPanel';
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

function App() {
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTransactionSubmit = async (data: TransactionData) => {
    setLoading(true);
    try {
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
    } catch (error) {
      console.error('Error:', error);
      // Handle error appropriately
    } finally {
      setLoading(false);
    }
  };

  const handleNavigation = (itemId: string) => {
    console.log('Navigate to:', itemId);
    // Handle navigation - could expand this for routing
  };

  return (
    <motion.div 
      className="app-layout"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
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
      
      <TransactionForm 
        onSubmit={handleTransactionSubmit}
        loading={loading}
      />
      
      <ResultPanel 
        result={result}
        loading={loading}
      />
    </motion.div>
  );
}

export default App;

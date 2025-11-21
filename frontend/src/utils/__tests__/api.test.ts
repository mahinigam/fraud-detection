// Mock API utilities FIRST, before any imports
import { vi } from 'vitest'

// Create mock functions
const mockApiCall = vi.fn()
const mockFraudDetectionAPI = {
  predict: vi.fn(),
  validateTransaction: vi.fn(),
  getBatch: vi.fn(),
  submitBatch: vi.fn()
}

vi.mock('../../lib/api', () => ({
  apiCall: mockApiCall,
  fraudDetectionAPI: mockFraudDetectionAPI
}))

import { expect, describe, it, beforeEach } from '../../test/setup'
import { createMockTransactionData, server } from '../../test/setup'
import { http, HttpResponse } from 'msw'

describe('Fraud Detection API', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    vi.clearAllMocks()
  })

  describe('Transaction Validation', () => {
    it('should validate transaction data structure', () => {
      const validTransaction = createMockTransactionData({
        amount: '100.00',
        senderId: 'user123',
        receiverId: 'user456'
      })
      
      expect(validTransaction).toHaveProperty('transactionId')
      expect(validTransaction).toHaveProperty('amount', '100.00')
      expect(validTransaction).toHaveProperty('senderId', 'user123')
      expect(validTransaction).toHaveProperty('receiverId', 'user456')
      expect(validTransaction).toHaveProperty('transactionType')
      expect(validTransaction).toHaveProperty('timeOfTransaction')
    })

    it('should reject invalid transaction amounts', async () => {
      const invalidTransaction = createMockTransactionData({
        amount: 'invalid-amount'
      })
      
      mockFraudDetectionAPI.validateTransaction.mockResolvedValue({
        isValid: false,
        errors: ['Invalid amount format']
      })
      
      const result = await mockFraudDetectionAPI.validateTransaction(invalidTransaction)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid amount format')
    })

    it('should validate required fields', async () => {
      const incompleteTransaction = {
        transactionId: 'test-123'
        // Missing required fields
      }
      
      mockFraudDetectionAPI.validateTransaction.mockResolvedValue({
        isValid: false,
        errors: [
          'senderId is required',
          'receiverId is required', 
          'amount is required'
        ]
      })
      
      const result = await mockFraudDetectionAPI.validateTransaction(incompleteTransaction)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('senderId is required')
      expect(result.errors).toContain('receiverId is required')
      expect(result.errors).toContain('amount is required')
    })
  })

  describe('Fraud Prediction', () => {
    it('should predict fraud for suspicious transactions', async () => {
      const suspiciousTransaction = createMockTransactionData({
        amount: '50000.00', // Very high amount
        timeOfTransaction: '03:00:00' // Unusual time
      })
      
      mockFraudDetectionAPI.predict.mockResolvedValue({
        prediction: 1,
        probability: 0.95,
        risk_score: 95,
        model_version: '1.0.0',
        processing_time: 150,
        risk_factors: [
          'High transaction amount',
          'Unusual transaction time'
        ]
      })
      
      const result = await mockFraudDetectionAPI.predict(suspiciousTransaction)
      
      expect(result.prediction).toBe(1)
      expect(result.probability).toBeGreaterThan(0.8)
      expect(result.risk_score).toBeGreaterThan(80)
      expect(result.risk_factors).toContain('High transaction amount')
    })

    it('should predict legitimate transactions as safe', async () => {
      const normalTransaction = createMockTransactionData({
        amount: '25.00',
        timeOfTransaction: '14:30:00'
      })
      
      mockFraudDetectionAPI.predict.mockResolvedValue({
        prediction: 0,
        probability: 0.05,
        risk_score: 5,
        model_version: '1.0.0',
        processing_time: 120
      })
      
      const result = await mockFraudDetectionAPI.predict(normalTransaction)
      
      expect(result.prediction).toBe(0)
      expect(result.probability).toBeLessThan(0.2)
      expect(result.risk_score).toBeLessThan(20)
    })

    it('should handle API errors gracefully', async () => {
      const transaction = createMockTransactionData()
      
      mockFraudDetectionAPI.predict.mockRejectedValue(
        new Error('API service unavailable')
      )
      
      await expect(mockFraudDetectionAPI.predict(transaction))
        .rejects.toThrow('API service unavailable')
    })

    it('should include model metadata in response', async () => {
      const transaction = createMockTransactionData()
      
      mockFraudDetectionAPI.predict.mockResolvedValue({
        prediction: 0,
        probability: 0.15,
        risk_score: 15,
        model_version: '2.1.0',
        processing_time: 175,
        confidence: 0.92,
        features_used: ['amount', 'time', 'location', 'user_history']
      })
      
      const result = await mockFraudDetectionAPI.predict(transaction)
      
      expect(result).toHaveProperty('model_version')
      expect(result).toHaveProperty('processing_time')
      expect(result).toHaveProperty('confidence')
      expect(result.features_used).toBeInstanceOf(Array)
    })
  })

  describe('Batch Processing', () => {
    it('should process multiple transactions in batch', async () => {
      const transactions = [
        createMockTransactionData({ amount: '100.00' }),
        createMockTransactionData({ amount: '200.00' }),
        createMockTransactionData({ amount: '50.00' })
      ]
      
      mockFraudDetectionAPI.submitBatch.mockResolvedValue({
        batch_id: 'batch-123',
        status: 'processing',
        transaction_count: 3,
        estimated_completion: '2024-01-01T10:05:00Z'
      })
      
      const result = await mockFraudDetectionAPI.submitBatch(transactions)
      
      expect(result.batch_id).toBeDefined()
      expect(result.transaction_count).toBe(3)
      expect(result.status).toBe('processing')
    })

    it('should handle batch size limits', async () => {
      const largeBatch = Array(1001).fill(null).map(() => createMockTransactionData())
      
      mockFraudDetectionAPI.submitBatch.mockRejectedValue(
        new Error('Batch size exceeds maximum limit of 1000 transactions')
      )
      
      await expect(mockFraudDetectionAPI.submitBatch(largeBatch))
        .rejects.toThrow('Batch size exceeds maximum limit')
    })

    it('should retrieve batch results', async () => {
      const batchId = 'batch-123'
      
      mockFraudDetectionAPI.getBatch.mockResolvedValue({
        batch_id: batchId,
        status: 'completed',
        results: [
          { transaction_id: 'txn-1', prediction: 0, probability: 0.1 },
          { transaction_id: 'txn-2', prediction: 1, probability: 0.9 },
          { transaction_id: 'txn-3', prediction: 0, probability: 0.2 }
        ],
        completion_time: '2024-01-01T10:05:30Z',
        total_processed: 3,
        fraud_detected: 1
      })
      
      const result = await mockFraudDetectionAPI.getBatch(batchId)
      
      expect(result.status).toBe('completed')
      expect(result.results).toHaveLength(3)
      expect(result.fraud_detected).toBe(1)
      expect(result.total_processed).toBe(3)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockApiCall.mockRejectedValue(new Error('Network error'))
      
      await expect(mockApiCall('/api/predict', 'POST', {}))
        .rejects.toThrow('Network error')
    })

    it('should handle authentication errors', async () => {
      mockApiCall.mockRejectedValue({
        status: 401,
        message: 'Unauthorized'
      })
      
      await expect(mockApiCall('/api/predict', 'POST', {}))
        .rejects.toMatchObject({
          status: 401,
          message: 'Unauthorized'
        })
    })

    it('should handle rate limiting', async () => {
      mockApiCall.mockRejectedValue({
        status: 429,
        message: 'Rate limit exceeded',
        retryAfter: 60
      })
      
      await expect(mockApiCall('/api/predict', 'POST', {}))
        .rejects.toMatchObject({
          status: 429,
          message: 'Rate limit exceeded'
        })
    })

    it('should handle validation errors', async () => {
      mockApiCall.mockRejectedValue({
        status: 400,
        message: 'Validation error',
        errors: [
          { field: 'amount', message: 'Must be a positive number' },
          { field: 'senderId', message: 'Invalid user ID format' }
        ]
      })
      
      await expect(mockApiCall('/api/predict', 'POST', {}))
        .rejects.toMatchObject({
          status: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'amount' }),
            expect.objectContaining({ field: 'senderId' })
          ])
        })
    })
  })

  describe('Real-time API Integration', () => {
    it('should handle real-time prediction requests', async () => {
      const transaction = createMockTransactionData()
      
      // Mock successful API response
      server.use(
        http.post('http://localhost:8000/predict', () => {
          return HttpResponse.json({
            prediction: 0,
            probability: 0.15,
            risk_score: 15,
            model_version: '1.0.0',
            processing_time: 150
          })
        })
      )
      
      mockFraudDetectionAPI.predict.mockImplementation(async (data) => {
        const response = await fetch('http://localhost:8000/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        return response.json()
      })
      
      const result = await mockFraudDetectionAPI.predict(transaction)
      
      expect(result.prediction).toBeDefined()
      expect(result.probability).toBeDefined()
      expect(result.risk_score).toBeDefined()
    })

    it('should timeout on slow responses', async () => {
      const transaction = createMockTransactionData()
      
      // Mock slow API response
      server.use(
        http.post('http://localhost:8000/predict', async () => {
          await new Promise(resolve => setTimeout(resolve, 35000)) // 35 second delay
          return HttpResponse.json({ prediction: 0 })
        })
      )
      
      mockFraudDetectionAPI.predict.mockImplementation(async () => {
        throw new Error('Request timeout')
      })
      
      await expect(mockFraudDetectionAPI.predict(transaction))
        .rejects.toThrow('Request timeout')
    })
  })
})
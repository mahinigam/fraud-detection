import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { config } from '../config/environment'

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ 
        data: { user: null }, 
        error: null 
      }),
      getSession: vi.fn().mockResolvedValue({ 
        data: { session: null }, 
        error: null 
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  })),
}))

// Mock handlers for MSW
export const handlers = [
  // Mock Supabase authentication
  http.post(`${config.database.supabaseUrl}/auth/v1/token`, () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'admin'
      }
    })
  }),

  // Mock fraud detection API
  http.post(`${config.api.fraudDetectionEndpoint}/predict`, () => {
    return HttpResponse.json({
      fraud_probability: 0.15,
      risk_score: 15,
      is_fraud: false,
      model_version: 'test-v1.0',
      processing_time: 250
    })
  }),

  // Mock user profile API
  http.get(`${config.database.supabaseUrl}/rest/v1/user_profiles`, () => {
    return HttpResponse.json([
      {
        id: 'test-user-id',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'admin',
        status: 'active',
        department: 'Security',
        created_at: new Date().toISOString()
      }
    ])
  }),

  // Mock audit logs API
  http.get(`${config.database.supabaseUrl}/rest/v1/audit_logs`, () => {
    return HttpResponse.json([
      {
        id: 'test-audit-id',
        user_id: 'test-user-id',
        action: 'login',
        resource_type: 'authentication',
        details: { login_method: 'email_password' },
        created_at: new Date().toISOString()
      }
    ])
  }),

  // Mock job management API
  http.post(`${config.database.supabaseUrl}/rest/v1/fraud_detection_jobs`, () => {
    return HttpResponse.json({
      id: 'test-job-id',
      user_id: 'test-user-id',
      status: 'pending',
      progress: 0,
      input_data: {},
      created_at: new Date().toISOString()
    }, { status: 201 })
  })
]

// Setup MSW server
export const server = setupServer(...handlers)

// Global test setup
beforeAll(() => {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'error' })

  // Mock global objects
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  })

  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock,
    writable: true
  })

  // Mock useAuth hook and AuthProvider
  vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
      user: { id: 'test-user-id', email: 'test@example.com' },
      userProfile: { 
        id: 'test-profile-id',
        user_id: 'test-user-id',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'admin' as const,
        status: 'active' as const,
        department: 'Security',
        created_at: new Date().toISOString()
      },
      session: { access_token: 'test-token' },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
      hasRole: vi.fn((roles: string[]) => {
        const userRole = 'admin'
        return roles.includes(userRole)
      }),
      hasPermission: vi.fn(() => true)
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children
  }))

  // Mock crypto for security utilities
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    },
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
    }
  }
})

// Mock canvas for device fingerprinting
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => ({
    textBaseline: '',
    font: '',
    fillText: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(16) })),
    toDataURL: vi.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='),
  })),
})  // Mock WebSocket for real-time features
  Object.defineProperty(global, 'WebSocket', {
    value: class MockWebSocket {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3
      
      readyState = 1
      close = vi.fn()
      send = vi.fn()
      addEventListener = vi.fn()
      removeEventListener = vi.fn()
      
      constructor() {}
    },
    writable: true
  })

  // Mock fetch if needed
  if (!global.fetch) {
    global.fetch = vi.fn()
  }

  // Suppress console errors in tests unless needed
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterAll(() => {
  // Clean up MSW server
  server.close()

  // Restore console methods
  vi.restoreAllMocks()
})

afterEach(() => {
  // Clean up React Testing Library
  cleanup()
  
  // Reset MSW handlers
  server.resetHandlers()
  
  // Clear all mocks
  vi.clearAllMocks()
  
  // Clear localStorage/sessionStorage
  localStorage.clear()
  sessionStorage.clear()
})

// Test utilities
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'admin',
  ...overrides
})

export const createMockUserProfile = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'admin',
  status: 'active',
  department: 'Security',
  created_at: new Date().toISOString(),
  ...overrides
})

export const createMockTransactionData = (overrides = {}) => ({
  transactionId: 'TXN-' + Math.random().toString(36).substring(2, 15),
  amount: '100.00',
  senderId: 'user123',
  receiverId: 'user456',
  transactionType: 'transfer',
  deviceId: 'device123',
  geoLocation: 'New York, NY',
  timeOfTransaction: new Date().toISOString(),
  paymentMethod: 'credit_card',
  ...overrides
})

// Custom render function with providers
export { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
export { userEvent } from '@testing-library/user-event'
export { vi, expect, describe, it, beforeEach, test } from 'vitest'
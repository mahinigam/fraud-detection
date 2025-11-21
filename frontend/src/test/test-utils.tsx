import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { vi } from 'vitest'

// Mock Supabase client
export const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: null },
      error: null
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: null },
      error: null
    }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    })
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn().mockResolvedValue({ data: [], error: null })
  }),
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn()
  }),
  removeChannel: vi.fn()
}

// Mock authentication context
export const mockAuthContext = {
  user: null,
  session: null,
  profile: null,
  isLoading: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn()
}

// Mock notification context
export const mockNotificationContext = {
  notifications: [],
  unreadCount: 0,
  addNotification: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn()
}

// Create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity
      }
    }
  })

// Custom providers wrapper
interface ProvidersProps {
  children: React.ReactNode
  queryClient?: QueryClient
}

const TestProviders: React.FC<ProvidersProps> = ({ 
  children, 
  queryClient = createTestQueryClient() 
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
        <Toaster position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
}

const customRender = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { queryClient, ...renderOptions } = options

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <TestProviders queryClient={queryClient}>
      {children}
    </TestProviders>
  )

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Authentication test helpers
export const mockAuthenticatedUser = (overrides = {}) => {
  const user = {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'admin',
    ...overrides
  }

  const profile = {
    id: 'test-user-id',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'admin',
    status: 'active',
    department: 'Security',
    created_at: new Date().toISOString(),
    ...overrides
  }

  mockSupabase.auth.getSession.mockResolvedValue({
    data: {
      session: {
        user,
        access_token: 'mock-token',
        refresh_token: 'mock-refresh-token'
      }
    },
    error: null
  })

  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user },
    error: null
  })

  return { user, profile }
}

export const mockUnauthenticatedUser = () => {
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null
  })

  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null
  })
}

// Navigation test helpers
export const mockNavigate = vi.fn()

// Form validation helpers
export const fillFormField = async (
  getByLabelText: any,
  label: string,
  value: string
) => {
  const input = getByLabelText(label)
  await input.focus()
  await input.clear()
  await input.type(value)
}

export const submitForm = async (getByRole: any) => {
  const submitButton = getByRole('button', { name: /submit|save|create/i })
  await submitButton.click()
}

// API response helpers
export const mockSuccessResponse = (data: any) => ({
  data,
  error: null,
  status: 200,
  statusText: 'OK'
})

export const mockErrorResponse = (message: string) => ({
  data: null,
  error: { message },
  status: 400,
  statusText: 'Bad Request'
})

// Wait helpers for async operations
export const waitForLoadingToFinish = async (getByTestId?: any) => {
  if (getByTestId) {
    const { waitForElementToBeRemoved } = await import('@testing-library/react')
    try {
      await waitForElementToBeRemoved(() => getByTestId('loading-spinner'), {
        timeout: 3000
      })
    } catch {
      // Loading spinner might not exist, that's ok
    }
  }
}

// Export everything including the custom render
export { customRender as render }
export * from '@testing-library/react'
export { userEvent } from '@testing-library/user-event'
export { vi, expect, describe, it, beforeEach, test, beforeAll, afterEach, afterAll } from 'vitest'
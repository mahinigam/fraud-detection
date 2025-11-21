import { vi } from 'vitest'
import React from 'react'

// Mock the useAuth hook BEFORE importing other modules
const mockUseAuth = vi.fn()
vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => mockUseAuth()
}))

import { render, screen, expect, describe, it, beforeEach } from '../../test/setup'
import { 
  withRouteProtection, 
  AdminOnly, 
  AnalystOnly, 
  RequirePermission,
  usePermissionGuard,
  RouteProtectionConfig 
} from '../RouteProtection'
import { AuthProvider } from '../../contexts/AuthContext'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

const TestComponent = () => <div data-testid="test-component">Protected Content</div>
const UnauthorizedComponent = () => <div data-testid="unauthorized">Unauthorized</div>

const MockedWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/unauthorized" element={<UnauthorizedComponent />} />
        <Route path="*" element={children} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
)

describe('withRouteProtection HOC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders component when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      userProfile: { role: 'admin', status: 'active' },
      loading: false,
      hasRole: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(true)
    })

    const ProtectedComponent = withRouteProtection(TestComponent, { allowUnauthenticated: false })

    render(
      <MockedWrapper>
        <ProtectedComponent />
      </MockedWrapper>
    )

    expect(screen.getByTestId('test-component')).toBeInTheDocument()
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('shows unauthorized when user lacks required role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@example.com' },
      userProfile: { role: 'analyst' },
      loading: false,
      error: null,
      signOut: vi.fn(),
      hasRole: vi.fn((roles) => {
        const userRole = 'analyst'
        return roles.includes(userRole)
      }),
      hasPermission: vi.fn(() => true)
    })

    const ProtectedComponent = withRouteProtection(TestComponent, { 
      requiredRoles: ['admin'] 
    })

    render(
      <MockedWrapper>
        <ProtectedComponent />
      </MockedWrapper>
    )

    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument()
    expect(screen.getByText(/access denied/i)).toBeInTheDocument()
  })

  it('shows loading state while authentication is being checked', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: true,
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn().mockReturnValue(false)
    })

    const ProtectedComponent = withRouteProtection(TestComponent)

    render(
      <MockedWrapper>
        <ProtectedComponent />
      </MockedWrapper>
    )

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument()
  })

  it('shows unauthorized when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn().mockReturnValue(false)
    })

    const ProtectedComponent = withRouteProtection(TestComponent)

    render(
      <MockedWrapper>
        <ProtectedComponent />
      </MockedWrapper>
    )

    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument()
    expect(screen.getByText(/authentication required/i)).toBeInTheDocument()
  })
})

describe('AdminOnly Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when user is admin', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      userProfile: { role: 'admin', status: 'active' },
      loading: false,
      hasRole: vi.fn().mockImplementation((roles) => roles.includes('admin')),
      hasPermission: vi.fn().mockReturnValue(true)
    })

    render(
      <MockedWrapper>
        <AdminOnly>
          <TestComponent />
        </AdminOnly>
      </MockedWrapper>
    )

    expect(screen.getByTestId('test-component')).toBeInTheDocument()
  })

  it('blocks access when user is not admin', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      userProfile: { role: 'analyst', status: 'active' },
      loading: false,
      hasRole: vi.fn().mockImplementation((roles) => !roles.includes('admin')),
      hasPermission: vi.fn().mockReturnValue(true)
    })

    render(
      <MockedWrapper>
        <AdminOnly>
          <TestComponent />
        </AdminOnly>
      </MockedWrapper>
    )

    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument()
    expect(screen.getByText(/access denied/i)).toBeInTheDocument()
  })
})

describe('AnalystOnly Component', () => {
  it('renders children when user is analyst', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      userProfile: { role: 'analyst', status: 'active' },
      loading: false,
      hasRole: vi.fn().mockImplementation((roles) => roles.includes('analyst')),
      hasPermission: vi.fn().mockReturnValue(true)
    })

    render(
      <MockedWrapper>
        <AnalystOnly>
          <TestComponent />
        </AnalystOnly>
      </MockedWrapper>
    )

    expect(screen.getByTestId('test-component')).toBeInTheDocument()
  })

  it('blocks access when user is not analyst', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      userProfile: { role: 'admin', status: 'active' },
      loading: false,
      hasRole: vi.fn().mockImplementation((roles) => !roles.includes('analyst')),
      hasPermission: vi.fn().mockReturnValue(true)
    })

    render(
      <MockedWrapper>
        <AnalystOnly>
          <TestComponent />
        </AnalystOnly>
      </MockedWrapper>
    )

    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument()
  })
})

describe('RequirePermission Component Factory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a component with specific permission requirements', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      userProfile: { role: 'admin', status: 'active' },
      loading: false,
      hasRole: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(true)
    })

    const ManageUsersComponent = RequirePermission('manage_users')

    render(
      <MockedWrapper>
        <ManageUsersComponent>
          <TestComponent />
        </ManageUsersComponent>
      </MockedWrapper>
    )

    expect(screen.getByTestId('test-component')).toBeInTheDocument()
  })

  it('blocks access when user lacks specific permission', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      userProfile: { role: 'analyst', status: 'active' },
      loading: false,
      hasRole: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(false)
    })

    const ManageUsersComponent = RequirePermission('manage_users')

    render(
      <MockedWrapper>
        <ManageUsersComponent>
          <TestComponent />
        </ManageUsersComponent>
      </MockedWrapper>
    )

    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument()
  })
})

describe('usePermissionGuard Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns permission check functions', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      userProfile: { role: 'admin', status: 'active' },
      loading: false,
      hasRole: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(true)
    })

    let hookResult: any
    
    function TestHookComponent() {
      hookResult = usePermissionGuard()
      return <div data-testid="hook-test">Hook Test</div>
    }

    render(
      <MockedWrapper>
        <TestHookComponent />
      </MockedWrapper>
    )

    expect(hookResult).toHaveProperty('canAccess')
    expect(hookResult).toHaveProperty('isAdmin')
    expect(hookResult).toHaveProperty('canManageUsers')
    expect(typeof hookResult.canAccess).toBe('function')
    expect(typeof hookResult.isAdmin).toBe('function')
    expect(typeof hookResult.canManageUsers).toBe('function')
  })
})
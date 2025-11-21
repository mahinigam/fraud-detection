import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Login from '../Login'
import { AuthProvider } from '../../contexts/AuthContext'

describe('Login Component', () => {
  beforeEach(() => {
    // Clear any previous state
  })

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  )

  it('renders login form with all required fields', () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    )

    expect(screen.getByText('Fraud Detection')).toBeInTheDocument()
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows validation errors for empty fields', async () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    )

    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
  })

  it('accepts input in email and password fields', async () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    )

    const emailInput = screen.getByLabelText('Email Address')
    const passwordInput = screen.getByLabelText('Password')

    // Enter invalid email and valid password
    await userEvent.type(emailInput, 'invalid-email')
    await userEvent.type(passwordInput, 'password123')

    // Form should accept the input
    expect(emailInput).toHaveValue('invalid-email')
    expect(passwordInput).toHaveValue('password123')
    
    // Email field should still be type="email" for browser validation
    expect(emailInput).toHaveAttribute('type', 'email')
  })

  it('shows validation error for empty password', async () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    )

    const emailInput = screen.getByLabelText('Email Address')
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await userEvent.type(emailInput, 'test@example.com')
    // Leave password empty
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
  })

  it('toggles password visibility', async () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    )

    const passwordInput = screen.getByLabelText('Password')
    const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i })

    expect(passwordInput).toHaveAttribute('type', 'password')

    await userEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')

    await userEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('handles form submission without error', async () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    )

    const emailInput = screen.getByLabelText('Email Address')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'validpassword123')
    
    expect(emailInput).toHaveValue('test@example.com')
    expect(passwordInput).toHaveValue('validpassword123')
    
    // Submit button should be enabled initially
    expect(submitButton).not.toBeDisabled()
    
    // Click submit - this will trigger Supabase auth (which is mocked)
    await userEvent.click(submitButton)
    
    // Form remains functional (no client-side validation errors)
    expect(emailInput).toHaveValue('test@example.com')
    expect(passwordInput).toHaveValue('validpassword123')
  })
})
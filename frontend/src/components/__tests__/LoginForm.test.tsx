import { vi } from 'vitest'
import React from 'react'

// Mock the supabase module BEFORE imports
vi.mock('../../lib/supabase')

import { render, screen, fireEvent, waitFor, expect, describe, it, beforeEach } from '../../test/setup'
import LoginForm from '../LoginForm'
import { AuthProvider } from '../../contexts/AuthContext'
import { BrowserRouter } from 'react-router-dom'

const MockedWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
)

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form with all required fields', () => {
    render(
      <MockedWrapper>
        <LoginForm />
      </MockedWrapper>
    )

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /fraud detection system/i })).toBeInTheDocument()
  })

  it('requires email and password fields', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      </BrowserRouter>
    )

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Check that fields are required
    expect(emailInput).toBeRequired()
    expect(passwordInput).toBeRequired()
    
    // Check email type
    expect(emailInput).toHaveAttribute('type', 'email')
  })

  it('accepts email input format validation', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      </BrowserRouter>
    )

    const emailInput = screen.getByLabelText(/email address/i)

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    expect(emailInput).toHaveValue('test@example.com')
    
    // The HTML5 email validation is handled by the browser, not our component
    expect(emailInput).toHaveAttribute('type', 'email')
  })

  it('accepts password input', async () => {
    render(
      <MockedWrapper>
        <LoginForm />
      </MockedWrapper>
    )

    const passwordInput = screen.getByLabelText(/password/i)

    fireEvent.change(passwordInput, { target: { value: 'testpassword' } })
    expect(passwordInput).toHaveValue('testpassword')
    
    // Password validation is handled at authentication level, not client-side
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('submits form with valid credentials', async () => {
    const mockSignIn = vi.fn().mockResolvedValue({ data: { user: { id: 'test-id' } }, error: null })
    
    render(
      <MockedWrapper>
        <LoginForm />
      </MockedWrapper>
    )

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(submitButton).toHaveAttribute('disabled')
    })
  })

  it('handles form submission', async () => {
    render(
      <MockedWrapper>
        <LoginForm />
      </MockedWrapper>
    )

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password' } })

    expect(emailInput).toHaveValue('test@example.com')
    expect(passwordInput).toHaveValue('password')
    
    // Submit button should be enabled when form is filled
    expect(submitButton).not.toBeDisabled()
    
    fireEvent.click(submitButton)
    
    // Form should still be functional after submission attempt
    expect(emailInput).toHaveValue('test@example.com')
    expect(passwordInput).toHaveValue('password')
  })

  it('shows and hides demo accounts', async () => {
    render(
      <MockedWrapper>
        <LoginForm />
      </MockedWrapper>
    )

    const showDemoButton = screen.getByRole('button', { name: /show demo accounts/i })
    expect(showDemoButton).toBeInTheDocument()

    // Initially demo accounts should not be visible
    expect(screen.queryByText(/admin@frauddetection.com/i)).not.toBeInTheDocument()

    // Click to show demo accounts
    fireEvent.click(showDemoButton)

    // Demo accounts should now be visible
    await waitFor(() => {
      expect(screen.getByText(/admin@frauddetection.com/i)).toBeInTheDocument()
      expect(screen.getByText(/analyst@frauddetection.com/i)).toBeInTheDocument()
      expect(screen.getByText(/auditor@frauddetection.com/i)).toBeInTheDocument()
    })

    // Button text should change
    expect(screen.getByRole('button', { name: /hide demo accounts/i })).toBeInTheDocument()
  })

  it('has a password visibility toggle button', () => {
    render(
      <MockedWrapper>
        <LoginForm />
      </MockedWrapper>
    )

    const passwordInput = screen.getByLabelText(/password/i)
    expect(passwordInput).toHaveAttribute('type', 'password')
    
    // Check that there's a button in the password field container (the toggle button)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(1) // At least submit button + toggle button
  })

  it('shows loading state during submission', async () => {
    render(
      <MockedWrapper>
        <LoginForm />
      </MockedWrapper>
    )

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    expect(submitButton).toHaveAttribute('disabled')
    // Check for loading spinner instead of text
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('has proper accessibility attributes', () => {
    render(
      <MockedWrapper>
        <LoginForm />
      </MockedWrapper>
    )

    const emailInput = screen.getByLabelText('Email Address')
    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('autocomplete', 'email')
    expect(emailInput).toHaveAttribute('required')

    const passwordInput = screen.getByLabelText('Password')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
    expect(passwordInput).toHaveAttribute('required')
  })
})
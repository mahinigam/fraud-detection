import { test, expect } from '@playwright/test'

// Test data
const validUser = {
  email: 'admin@frauddetection.com',
  password: 'admin123'
}

test.describe('Fraud Detection System E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173')
  })

  test.describe('Authentication Flow', () => {
    test('should login with valid credentials', async ({ page }) => {
      // Fill in login form
      await page.fill('input[type="email"]', validUser.email)
      await page.fill('input[type="password"]', validUser.password)
      
      // Click login button
      await page.click('button[type="submit"]')
      
      // Wait for navigation to dashboard
      await expect(page).toHaveURL(/.*\/dashboard/)
      
      // Verify dashboard elements are present
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible()
      await expect(page.locator('[data-testid="main-navigation"]')).toBeVisible()
    })

    test('should show error for invalid credentials', async ({ page }) => {
      // Fill in login form with invalid credentials
      await page.fill('input[type="email"]', 'invalid@example.com')
      await page.fill('input[type="password"]', 'wrongpassword')
      
      // Click login button
      await page.click('button[type="submit"]')
      
      // Verify error message appears
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials')
      
      // Should remain on login page
      await expect(page).toHaveURL(/.*\/login/)
    })

    test('should validate form fields', async ({ page }) => {
      // Click submit without filling fields
      await page.click('button[type="submit"]')
      
      // Verify validation errors
      await expect(page.locator('text=Email is required')).toBeVisible()
      await expect(page.locator('text=Password is required')).toBeVisible()
    })
  })

  test.describe('Navigation and Routing', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.fill('input[type="email"]', validUser.email)
      await page.fill('input[type="password"]', validUser.password)
      await page.click('button[type="submit"]')
      await page.waitForURL(/.*\/dashboard/)
    })

    test('should navigate through main sections', async ({ page }) => {
      // Test Dashboard navigation
      await page.click('[data-testid="nav-dashboard"]')
      await expect(page).toHaveURL(/.*\/dashboard/)
      await expect(page.locator('h1')).toContainText('Dashboard')

      // Test Fraud Detection navigation
      await page.click('[data-testid="nav-fraud-detection"]')
      await expect(page).toHaveURL(/.*\/fraud-detection/)
      await expect(page.locator('h1')).toContainText('Fraud Detection')

      // Test Analytics navigation (if admin)
      const analyticsNav = page.locator('[data-testid="nav-analytics"]')
      if (await analyticsNav.isVisible()) {
        await analyticsNav.click()
        await expect(page).toHaveURL(/.*\/analytics/)
        await expect(page.locator('h1')).toContainText('Analytics')
      }
    })

    test('should show role-based menu items', async ({ page }) => {
      // Admin should see all menu items
      await expect(page.locator('[data-testid="nav-user-management"]')).toBeVisible()
      await expect(page.locator('[data-testid="nav-system-settings"]')).toBeVisible()
      await expect(page.locator('[data-testid="nav-audit-logs"]')).toBeVisible()
    })
  })

  test.describe('Fraud Detection Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Login and navigate to fraud detection
      await page.fill('input[type="email"]', validUser.email)
      await page.fill('input[type="password"]', validUser.password)
      await page.click('button[type="submit"]')
      await page.waitForURL(/.*\/dashboard/)
      await page.click('[data-testid="nav-fraud-detection"]')
    })

    test('should process single transaction analysis', async ({ page }) => {
      // Fill in transaction form
      await page.fill('[data-testid="transaction-id"]', 'TEST-TXN-001')
      await page.fill('[data-testid="amount"]', '1500.00')
      await page.fill('[data-testid="sender-id"]', 'user123')
      await page.fill('[data-testid="receiver-id"]', 'user456')
      await page.selectOption('[data-testid="transaction-type"]', 'transfer')
      
      // Submit for analysis
      await page.click('[data-testid="analyze-button"]')
      
      // Wait for results
      await expect(page.locator('[data-testid="analysis-results"]')).toBeVisible({ timeout: 10000 })
      
      // Verify results contain required information
      await expect(page.locator('[data-testid="fraud-prediction"]')).toBeVisible()
      await expect(page.locator('[data-testid="risk-score"]')).toBeVisible()
      await expect(page.locator('[data-testid="confidence-level"]')).toBeVisible()
    })

    test('should handle invalid transaction data', async ({ page }) => {
      // Submit form with invalid data
      await page.fill('[data-testid="amount"]', 'invalid-amount')
      await page.click('[data-testid="analyze-button"]')
      
      // Verify validation errors
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible()
      await expect(page.locator('text=Invalid amount format')).toBeVisible()
    })

    test('should show loading state during analysis', async ({ page }) => {
      // Fill valid transaction data
      await page.fill('[data-testid="transaction-id"]', 'TEST-TXN-002')
      await page.fill('[data-testid="amount"]', '500.00')
      await page.fill('[data-testid="sender-id"]', 'user789')
      await page.fill('[data-testid="receiver-id"]', 'user012')
      
      // Submit and verify loading state
      await page.click('[data-testid="analyze-button"]')
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible()
      
      // Verify loading disappears when complete
      await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('Batch Processing', () => {
    test.beforeEach(async ({ page }) => {
      // Login and navigate to batch processing
      await page.fill('input[type="email"]', validUser.email)
      await page.fill('input[type="password"]', validUser.password)
      await page.click('button[type="submit"]')
      await page.waitForURL(/.*\/dashboard/)
      await page.click('[data-testid="nav-batch-processing"]')
    })

    test('should upload and process CSV file', async ({ page }) => {
      // Create test CSV content
      const csvContent = `transactionId,amount,senderId,receiverId,transactionType
TEST-001,100.00,user1,user2,transfer
TEST-002,250.00,user3,user4,transfer
TEST-003,1000.00,user5,user6,transfer`
      
      // Upload file
      await page.setInputFiles('[data-testid="csv-upload"]', {
        name: 'test-transactions.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent)
      })
      
      // Start processing
      await page.click('[data-testid="process-batch-button"]')
      
      // Verify batch job created
      await expect(page.locator('[data-testid="batch-job-status"]')).toBeVisible()
      await expect(page.locator('text=Processing')).toBeVisible()
      
      // Wait for completion (with reasonable timeout)
      await expect(page.locator('text=Completed')).toBeVisible({ timeout: 30000 })
    })

    test('should show batch results', async ({ page }) => {
      // Assume there's a completed batch job
      await page.click('[data-testid="view-results-button"]')
      
      // Verify results table is shown
      await expect(page.locator('[data-testid="batch-results-table"]')).toBeVisible()
      await expect(page.locator('thead')).toContainText('Transaction ID')
      await expect(page.locator('thead')).toContainText('Prediction')
      await expect(page.locator('thead')).toContainText('Risk Score')
    })
  })

  test.describe('User Management (Admin Only)', () => {
    test.beforeEach(async ({ page }) => {
      // Login as admin and navigate to user management
      await page.fill('input[type="email"]', validUser.email)
      await page.fill('input[type="password"]', validUser.password)
      await page.click('button[type="submit"]')
      await page.waitForURL(/.*\/dashboard/)
      await page.click('[data-testid="nav-user-management"]')
    })

    test('should display user list', async ({ page }) => {
      await expect(page.locator('[data-testid="users-table"]')).toBeVisible()
      await expect(page.locator('thead')).toContainText('Name')
      await expect(page.locator('thead')).toContainText('Email')
      await expect(page.locator('thead')).toContainText('Role')
      await expect(page.locator('thead')).toContainText('Status')
    })

    test('should create new user', async ({ page }) => {
      // Click create user button
      await page.click('[data-testid="create-user-button"]')
      
      // Fill user form
      await page.fill('[data-testid="user-name"]', 'Test User')
      await page.fill('[data-testid="user-email"]', 'testuser@example.com')
      await page.selectOption('[data-testid="user-role"]', 'analyst')
      
      // Submit form
      await page.click('[data-testid="save-user-button"]')
      
      // Verify success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
      await expect(page.locator('text=User created successfully')).toBeVisible()
    })

    test('should edit existing user', async ({ page }) => {
      // Click edit button for first user
      await page.locator('[data-testid="edit-user-button"]').first().click()
      
      // Modify user details
      await page.fill('[data-testid="user-name"]', 'Updated Name')
      
      // Save changes
      await page.click('[data-testid="save-user-button"]')
      
      // Verify update success
      await expect(page.locator('text=User updated successfully')).toBeVisible()
    })
  })

  test.describe('Audit Logs', () => {
    test.beforeEach(async ({ page }) => {
      // Login and navigate to audit logs
      await page.fill('input[type="email"]', validUser.email)
      await page.fill('input[type="password"]', validUser.password)
      await page.click('button[type="submit"]')
      await page.waitForURL(/.*\/dashboard/)
      await page.click('[data-testid="nav-audit-logs"]')
    })

    test('should display audit log entries', async ({ page }) => {
      await expect(page.locator('[data-testid="audit-logs-table"]')).toBeVisible()
      await expect(page.locator('thead')).toContainText('Timestamp')
      await expect(page.locator('thead')).toContainText('User')
      await expect(page.locator('thead')).toContainText('Action')
      await expect(page.locator('thead')).toContainText('Resource')
    })

    test('should filter logs by date range', async ({ page }) => {
      // Set date range
      await page.fill('[data-testid="start-date"]', '2024-01-01')
      await page.fill('[data-testid="end-date"]', '2024-01-31')
      
      // Apply filter
      await page.click('[data-testid="apply-filter-button"]')
      
      // Verify filtering worked
      const rows = page.locator('[data-testid="audit-logs-table"] tbody tr')
      await expect(rows).toHaveCount(await rows.count())
    })

    test('should search logs by action type', async ({ page }) => {
      // Search for login actions
      await page.fill('[data-testid="search-input"]', 'login')
      await page.press('[data-testid="search-input"]', 'Enter')
      
      // Verify search results
      await expect(page.locator('[data-testid="audit-logs-table"] tbody')).toContainText('login')
    })
  })

  test.describe('Session Management', () => {
    test('should handle session timeout', async ({ page }) => {
      // Login
      await page.fill('input[type="email"]', validUser.email)
      await page.fill('input[type="password"]', validUser.password)
      await page.click('button[type="submit"]')
      await page.waitForURL(/.*\/dashboard/)
      
      // Mock session timeout by setting a very short timeout
      await page.evaluate(() => {
        localStorage.setItem('session_timeout_override', '1000') // 1 second
      })
      
      // Wait for timeout warning
      await expect(page.locator('[data-testid="session-warning"]')).toBeVisible({ timeout: 5000 })
      
      // Should eventually redirect to login
      await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 })
    })

    test('should extend session on activity', async ({ page }) => {
      // Login
      await page.fill('input[type="email"]', validUser.email)
      await page.fill('input[type="password"]', validUser.password)
      await page.click('button[type="submit"]')
      await page.waitForURL(/.*\/dashboard/)
      
      // Simulate user activity
      await page.click('body')
      await page.mouse.move(100, 100)
      await page.keyboard.press('Tab')
      
      // Session should remain active
      await expect(page).toHaveURL(/.*\/dashboard/)
    })
  })

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Login on mobile
      await page.fill('input[type="email"]', validUser.email)
      await page.fill('input[type="password"]', validUser.password)
      await page.click('button[type="submit"]')
      await page.waitForURL(/.*\/dashboard/)
      
      // Verify mobile navigation works
      await page.click('[data-testid="mobile-menu-toggle"]')
      await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible()
      
      // Test navigation on mobile
      await page.click('[data-testid="nav-fraud-detection"]')
      await expect(page).toHaveURL(/.*\/fraud-detection/)
    })

    test('should work on tablet devices', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })
      
      // Login on tablet
      await page.fill('input[type="email"]', validUser.email)
      await page.fill('input[type="password"]', validUser.password)
      await page.click('button[type="submit"]')
      await page.waitForURL(/.*\/dashboard/)
      
      // Verify layout adapts to tablet
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible()
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Intercept network requests and make them fail
      await page.route('**/api/**', (route) => {
        route.abort('failed')
      })
      
      // Login should show error
      await page.fill('input[type="email"]', validUser.email)
      await page.fill('input[type="password"]', validUser.password)
      await page.click('button[type="submit"]')
      
      // Should show network error message
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible()
    })

    test('should handle unauthorized access', async ({ page }) => {
      // Try to access protected route without login
      await page.goto('http://localhost:5173/admin/users')
      
      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/)
      
      // Should show unauthorized message
      await expect(page.locator('text=Please log in to access this page')).toBeVisible()
    })
  })
})
import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('Setting up E2E test environment...')

  // Launch browser for setup
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    // Wait for dev server to be ready
    console.log('Waiting for dev server...')
    let retries = 0
    const maxRetries = 30

    while (retries < maxRetries) {
      try {
        await page.goto(config.webServer?.url || 'http://localhost:5173', {
          waitUntil: 'networkidle',
          timeout: 5000
        })
        console.log('Dev server is ready')
        break
      } catch (error) {
        retries++
        if (retries === maxRetries) {
          throw new Error(`Dev server not ready after ${maxRetries} attempts`)
        }
        console.log(`Retrying... (${retries}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // Setup test data if needed
    console.log('Setting up test data...')

    // Check if the application is accessible
    const title = await page.title()
    console.log(`Application title: ${title}`)

    // Verify login page is accessible
    const loginForm = await page.locator('form').first()
    if (await loginForm.isVisible()) {
      console.log('Login form is accessible')
    } else {
      console.warn('Login form not found - this might affect tests')
    }

    console.log('E2E test environment setup complete')

  } catch (error) {
    console.error('Failed to setup E2E test environment:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup
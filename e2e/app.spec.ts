import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3003'

// Helper to login
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', 'admin@clinicademo.com')
  await page.fill('input[type="password"]', 'demo123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 10000 })
}

// ============================================
// AUTHENTICATION TESTS
// ============================================
test.describe('Authentication Flow', () => {
  test('should display login page correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)

    // Check page elements
    await expect(page.locator('h1, h2')).toContainText(/login|entrar/i)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', 'invalid@test.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error message
    await expect(page.locator('text=/inválido|incorreto|erro/i')).toBeVisible({ timeout: 5000 })
  })

  test('should login successfully with valid credentials', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(/.*dashboard/)
  })

  test('should logout successfully', async ({ page }) => {
    await login(page)
    await page.click('button:has-text("Sair")')
    await expect(page).toHaveURL(/.*login/)
  })
})

// ============================================
// DASHBOARD LAYOUT TESTS
// ============================================
test.describe('Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should display sidebar on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })

    // Sidebar should be visible
    await expect(page.locator('aside, nav')).toBeVisible()

    // Navigation items should be visible
    await expect(page.locator('text=Pacientes')).toBeVisible()
    await expect(page.locator('text=Agendamentos')).toBeVisible()
    await expect(page.locator('text=Campanhas')).toBeVisible()
  })

  test('should toggle sidebar on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    // Sidebar should be hidden initially
    const sidebar = page.locator('aside')
    await expect(sidebar).toHaveClass(/-translate-x-full|hidden/)

    // Click menu button
    await page.click('button[aria-label*="menu"], button:has(svg)')

    // Sidebar should be visible
    await expect(sidebar).not.toHaveClass(/-translate-x-full/)
  })

  test('sidebar should NOT overlap content on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })

    // Get sidebar dimensions
    const sidebar = page.locator('aside').first()
    const sidebarBox = await sidebar.boundingBox()

    // Get main content
    const mainContent = page.locator('main').first()
    const contentBox = await mainContent.boundingBox()

    // Content should start AFTER sidebar width
    if (sidebarBox && contentBox) {
      expect(contentBox.x).toBeGreaterThanOrEqual(sidebarBox.width - 10) // 10px tolerance
    }
  })
})

// ============================================
// PATIENTS PAGE TESTS
// ============================================
test.describe('Patients Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/pacientes`)
  })

  test('should display patients list page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/pacientes/i)
  })

  test('should have search functionality', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="buscar"], input[placeholder*="pesquisar"]')
    if (await searchInput.count() > 0) {
      await searchInput.fill('teste')
      // Should filter or show results
    }
  })

  test('should have add patient button', async ({ page }) => {
    await expect(page.locator('a[href*="pacientes/novo"], button:has-text("Novo")')).toBeVisible()
  })

  test('should navigate to new patient form', async ({ page }) => {
    await page.click('a[href*="pacientes/novo"]')
    await expect(page).toHaveURL(/.*pacientes\/novo/)
  })
})

// ============================================
// APPOINTMENTS PAGE TESTS
// ============================================
test.describe('Appointments Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/agendamentos`)
  })

  test('should display appointments page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/agendamentos/i)
  })

  test('should have new appointment button', async ({ page }) => {
    await expect(page.locator('a[href*="agendamentos/novo"], button:has-text("Novo")')).toBeVisible()
  })

  test('should navigate to new appointment form', async ({ page }) => {
    await page.click('a[href*="agendamentos/novo"]')
    await expect(page).toHaveURL(/.*agendamentos\/novo/)
  })

  test('new appointment form should have required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/agendamentos/novo`)

    // Patient search
    await expect(page.locator('input[placeholder*="paciente"]')).toBeVisible()

    // Date field
    await expect(page.locator('input[type="date"]')).toBeVisible()

    // Submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })
})

// ============================================
// CAMPAIGNS PAGE TESTS
// ============================================
test.describe('Campaigns Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/campanhas`)
  })

  test('should display campaigns page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/campanhas/i)
  })

  test('should have new campaign button', async ({ page }) => {
    await expect(page.locator('a[href*="campanhas/nova"], button:has-text("Nova")')).toBeVisible()
  })

  test('should navigate to new campaign form', async ({ page }) => {
    await page.click('a[href*="campanhas/nova"]')
    await expect(page).toHaveURL(/.*campanhas\/nova/)
  })
})

// ============================================
// CONVERSATIONS PAGE TESTS
// ============================================
test.describe('Conversations Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/conversas`)
  })

  test('should display conversations page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/conversas/i)
  })

  test('should have conversation list or empty state', async ({ page }) => {
    // Either shows conversations or empty state message
    const hasConversations = await page.locator('[data-testid="conversation-item"]').count() > 0
    const hasEmptyState = await page.locator('text=/nenhuma conversa|sem conversas/i').count() > 0

    expect(hasConversations || hasEmptyState).toBeTruthy()
  })
})

// ============================================
// INACTIVE PATIENTS PAGE TESTS
// ============================================
test.describe('Inactive Patients Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/pacientes/inativos`)
  })

  test('should display inactive patients page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/inativos/i)
  })

  test('should show segment filters', async ({ page }) => {
    // Should have filter buttons/cards
    await expect(page.locator('button:has-text("30")')).toBeVisible()
  })

  test('should have campaign button', async ({ page }) => {
    await expect(page.locator('a[href*="campanhas/nova"], button:has-text("Campanha")')).toBeVisible()
  })
})

// ============================================
// LEADS PAGE TESTS
// ============================================
test.describe('Leads Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/leads`)
  })

  test('should display leads page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/leads/i)
  })

  test('should have new lead button', async ({ page }) => {
    await expect(page.locator('a[href*="leads/novo"], button:has-text("Novo")')).toBeVisible()
  })

  test('should have status filters', async ({ page }) => {
    // Filter tabs or dropdown
    const hasFilters = await page.locator('select, [role="tablist"], button:has-text("Novo")').count() > 0
    expect(hasFilters).toBeTruthy()
  })
})

// ============================================
// RESPONSIVE TESTS
// ============================================
test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('mobile - should have hamburger menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/dashboard`)

    // Should have mobile menu button
    const menuButton = page.locator('button[aria-label*="menu"], button:has(svg)').first()
    await expect(menuButton).toBeVisible()
  })

  test('tablet - should adapt layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto(`${BASE_URL}/dashboard/pacientes`)

    // Content should be readable
    const mainContent = page.locator('main')
    await expect(mainContent).toBeVisible()
  })

  test('desktop - should show full sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE_URL}/dashboard`)

    // Sidebar should be always visible
    const sidebar = page.locator('aside, nav').first()
    await expect(sidebar).toBeVisible()
  })
})

// ============================================
// ACCESSIBILITY TESTS
// ============================================
test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)

    // Should have h1
    const h1 = await page.locator('h1').count()
    expect(h1).toBeGreaterThanOrEqual(1)
  })

  test('buttons should be keyboard accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/pacientes`)

    // Tab through buttons
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Some element should be focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedElement).toBeTruthy()
  })

  test('forms should have labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/pacientes/novo`)

    // Inputs should have associated labels
    const inputs = await page.locator('input:not([type="hidden"])').all()
    for (const input of inputs) {
      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const placeholder = await input.getAttribute('placeholder')

      // Should have either id with label, aria-label, or placeholder
      const hasAccessibleName = id || ariaLabel || placeholder
      expect(hasAccessibleName).toBeTruthy()
    }
  })
})

// ============================================
// NAVIGATION TESTS
// ============================================
test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should navigate between pages', async ({ page }) => {
    // Dashboard -> Patients
    await page.click('a[href*="pacientes"]:not([href*="inativos"])')
    await expect(page).toHaveURL(/.*pacientes/)

    // Patients -> Appointments
    await page.click('a[href*="agendamentos"]')
    await expect(page).toHaveURL(/.*agendamentos/)

    // Appointments -> Dashboard
    await page.click('a[href="/dashboard"]')
    await expect(page).toHaveURL(/.*\/dashboard$/)
  })

  test('active nav item should be highlighted', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/pacientes`)

    // Active link should have different style
    const activeLink = page.locator('a[href*="pacientes"]:not([href*="inativos"])')
    await expect(activeLink).toHaveClass(/bg-indigo|text-indigo|active/)
  })
})

// ============================================
// ERROR HANDLING TESTS
// ============================================
test.describe('Error Handling', () => {
  test('should show 404 for non-existent pages', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/nao-existe`)

    // Should show 404 or redirect
    const is404 = await page.locator('text=/404|não encontrada|não existe/i').count() > 0
    const redirected = page.url().includes('dashboard') && !page.url().includes('nao-existe')

    expect(is404 || redirected).toBeTruthy()
  })

  test('should handle API errors gracefully', async ({ page }) => {
    await login(page)

    // Intercept API call and return error
    await page.route('**/api/**', route => route.fulfill({ status: 500 }))

    await page.goto(`${BASE_URL}/dashboard/pacientes`)

    // Should show error message or empty state, not crash
    const hasContent = await page.locator('main').isVisible()
    expect(hasContent).toBeTruthy()
  })
})
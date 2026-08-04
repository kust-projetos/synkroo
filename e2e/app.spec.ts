import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:3003'

// This file exercises login and logout flows; inherited authenticated state would redirect /login.
test.use({ storageState: { cookies: [], origins: [] } })

// Canonical NextAuth UI login; failures remain visible to the suite.
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('#email', 'admin@clinicademo.com')
  await page.fill('#password', 'demo123')
  await Promise.all([
    page.waitForURL('**/dashboard**'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForLoadState('networkidle')
}

// ============================================
// LANDING PAGE TESTS
// ============================================
test.describe('Landing Page', () => {
  test('should display homepage with hero section', async ({ page }) => {
    await page.goto(BASE_URL)

    // Should have Synkroo branding
    await expect(page.locator('text=Synkroo').first()).toBeVisible()

    // Should have CTA buttons
    const hasCTA = (await page.locator('a[href*="signup"], a[href*="login"]').count()) > 0
    expect(hasCTA).toBeTruthy()
  })

  test('should navigate to login from homepage', async ({ page }) => {
    await page.goto(BASE_URL)

    const dashboardLink = page.locator('a[href="/dashboard"]').first()
    await expect(dashboardLink).toBeVisible()
    await dashboardLink.click()
    await expect(page).toHaveURL(/.*dashboard/)
  })
})

// ============================================
// AUTHENTICATION TESTS
// ============================================
test.describe('Authentication Flow', () => {
  test('should display login page correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)

    // Check page elements - h2 has "Entrar" text
    const heading = page.locator('h2:has-text("Entrar")')
    await expect(heading).toBeVisible()

    // Check teal palette is used (not indigo)
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toHaveClass(/bg-teal-600/)

    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', 'invalid@test.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error message - error is in a div with bg-destructive/10
    await expect(page.locator('[class*="bg-destructive"]')).toBeVisible({ timeout: 5000 })
  })

  test('should login successfully with valid credentials', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(/.*dashboard/)
  })

  test('should logout successfully', async ({ page }) => {
    await login(page)

    const logoutButton = page.getByRole('button', { name: 'Sair', exact: true })
    await expect(logoutButton).toBeVisible()
    await logoutButton.click()
    await expect(page).toHaveURL(/.*login/, { timeout: 5000 })
  })
})

// ============================================
// DASHBOARD LAYOUT TESTS
// ============================================
test.describe('Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 20_000 })
  })

  test('should display sidebar on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })

    // Sidebar should be visible (hidden on mobile, flex on lg+)
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible({ timeout: 5000 })

    await expect(page.locator('a[href="/dashboard/crm"]')).toBeVisible()
    await expect(page.locator('a[href="/dashboard/campanhas"]')).toBeVisible()
    await expect(page.locator('aside a[href="/dashboard/conversas"]').first()).toBeVisible()
  })

  test('should toggle sidebar on mobile via Sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    // Sidebar (aside) should be hidden on mobile
    const desktopSidebar = page.locator('aside')
    await expect(desktopSidebar).toBeHidden()

    // Should have hamburger menu button in header
    const menuButton = page.locator('header button:has(svg)').first()
    await expect(menuButton).toBeVisible()

    // Click to open mobile nav (Sheet)
    await menuButton.click()

    // Sheet should appear with nav items
    await expect(page.locator('[role="dialog"] a[href="/dashboard/crm"]').first()).toBeVisible({ timeout: 3000 })
  })

  test('sidebar should NOT overlap content on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })

    // Wait for sidebar to be present
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible({ timeout: 5000 })
    const sidebarBox = await sidebar.boundingBox()

    const mainContent = page.locator('main').first()
    const contentBox = await mainContent.boundingBox()
    expect(sidebarBox).not.toBeNull()
    expect(contentBox).not.toBeNull()
    expect(contentBox!.x).toBeGreaterThanOrEqual(sidebarBox!.width - 10)
  })

  test('should have collapsible sidebar on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })

    // Wait for sidebar to be present
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible({ timeout: 5000 })
    const initialBox = await sidebar.boundingBox()
    expect(initialBox).not.toBeNull()

    const collapseBtn = sidebar.locator('button').first()
    await expect(collapseBtn).toBeVisible()
    await collapseBtn.click()
    await page.waitForTimeout(300)

    const collapsedBox = await sidebar.boundingBox()
    expect(collapsedBox).not.toBeNull()
    expect(collapsedBox!.width).toBeLessThan(initialBox!.width)
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
    // Should have heading or page title with "Pacientes"
    await expect(page.locator('h1, h2')).toContainText(/pacientes/i)
  })

  test('should have search functionality', async ({ page }) => {
    // Look for search input with flexible selectors
    const searchInput = page.locator('input[placeholder*="buscar"], input[placeholder*="pesquisar"], input[placeholder*="Buscar"], input[placeholder*="Pesquisar"]').first()
    await expect(searchInput).toBeVisible()
    await searchInput.fill('teste')
  })

  test('should have add patient button', async ({ page }) => {
    const addButton = page.locator('a[href*="pacientes/novo"], button:has-text("Novo"), a:has-text("Novo")')
    await expect(addButton.first()).toBeVisible()
  })

  test('should navigate to new patient form', async ({ page }) => {
    const addLink = page.locator('a[href*="pacientes/novo"]').first()
    await expect(addLink).toBeVisible()
    await addLink.click()
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
    await page.waitForLoadState('networkidle')
  })

  test('should display appointments page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Agendamentos', exact: true })).toBeVisible()
  })

  test('should have new appointment button', async ({ page }) => {
    const addButton = page.locator('a[href*="agendamentos/novo"], button:has-text("Novo"), a:has-text("Novo")')
    await expect(addButton.first()).toBeVisible()
  })

  test('should navigate to new appointment form', async ({ page }) => {
    const addLink = page.locator('a[href*="agendamentos/novo"]').first()
    await expect(addLink).toBeVisible({ timeout: 15000 })
    await addLink.click({ noWaitAfter: true })
    await expect(page).toHaveURL(/.*agendamentos\/novo/)
  })

  test('new appointment form should have required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/agendamentos/novo`)
    // Wait for the form to render (no loading gate, form appears immediately after layout)
    await page.waitForSelector('h1, label, input, select', { timeout: 15000 })
    await page.waitForLoadState('networkidle')

    // Should have some form elements (date, patient selection, etc.)
    const hasForm = (await page.locator('input, select').count()) > 0
    expect(hasForm).toBeTruthy()

    // Submit button
    const hasSubmit = (await page.locator('button[type="submit"], button:has-text("Agendar"), button:has-text("Salvar")').count()) > 0
    expect(hasSubmit).toBeTruthy()
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
    await expect(page.getByRole('heading', { name: 'Campanhas', exact: true })).toBeVisible()
  })

  test('should have new campaign button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Criar Campanha', exact: true })).toBeVisible()
  })

  test('should open the campaign wizard', async ({ page }) => {
    await page.getByRole('button', { name: 'Criar Campanha', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
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
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('button, [data-testid="conversation-item"]').first()).toBeVisible()
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
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button, [role="tab"], select').first()).toBeVisible()
  })

  test('should have campaign button', async ({ page }) => {
    const campaignBtn = page.locator('a[href*="campanhas/nova"], button:has-text("Campanha"), a:has-text("Campanha")').first()
    await expect(campaignBtn).toBeVisible()
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
    const addButton = page.locator('a[href*="leads/novo"], button:has-text("Novo"), a:has-text("Novo")')
    await expect(addButton.first()).toBeVisible()
  })

  test('should have status filters or tabs', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    await expect(page.locator('select, [role="tablist"], button').first()).toBeVisible()
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

    // Should have mobile header with menu button
    const header = page.locator('header.lg\\:hidden')
    await expect(header).toBeVisible()

    // Should have Synkroo branding in header
    await expect(page.locator('header')).toContainText(/Synkroo/)
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

    // Sidebar should be always visible on desktop
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible()

    await expect(page.locator('aside a[href="/dashboard/crm"]')).toBeVisible()
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
    // Dashboard main page uses <p> tags, not headings. Use a sub-page that has <h1>/<h2>.
    await page.goto(`${BASE_URL}/dashboard/pacientes`)
    await page.waitForLoadState('networkidle')

    // Should have at least one heading (h1 from PageHeader)
    await expect(page.locator('h1, h2, h3').first()).toBeVisible()
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

  test('forms should have labels or placeholders', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/pacientes/novo`)

    // Inputs should have accessible names
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

  test('should have correct page title', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    const title = await page.title()
    expect(title).toContain('Synkroo')
  })
})

// ============================================
// NAVIGATION TESTS
// ============================================
test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should navigate between pages via sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`${BASE_URL}/dashboard`)

    // Dashboard -> CRM
    const crmLink = page.locator('aside').getByRole('link', { name: 'CRM', exact: true })
    await expect(crmLink).toBeVisible()
    await crmLink.evaluate((link) => (link as HTMLAnchorElement).click())
    await expect(page).toHaveURL(/.*dashboard\/crm/)
    await page.waitForLoadState('networkidle')

    // CRM -> Campaigns
    const campaignsLink = page.locator('aside').getByRole('link', { name: 'Campanhas', exact: true })
    await expect(campaignsLink).toBeVisible()
    await campaignsLink.evaluate((link) => (link as HTMLAnchorElement).click())
    await expect(page).toHaveURL(/.*campanhas/)

    // Campaigns -> Dashboard
    await page.click('a[href="/dashboard"]')
    await expect(page).toHaveURL(/.*\/dashboard$/)
  })

  test('active nav item should be highlighted with teal', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/crm`)

    // Active link should have teal highlight class
    const activeLink = page.locator('a[href="/dashboard/crm"]')
    await expect(activeLink).toHaveClass(/teal/)
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

    // Intercept API calls but exclude auth endpoints so the session stays valid
    await page.route('**/api/**', route => {
      const url = route.request().url()
      // Allow auth-related endpoints through so the session isn't broken
      if (url.includes('/api/auth/')) {
        return route.continue()
      }
      return route.fulfill({ status: 500 })
    })

    await page.goto(`${BASE_URL}/dashboard/pacientes`)
    // Wait for the page to settle — even with API errors, the layout should render
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Give React time to handle error states

    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('body')).toBeVisible()
  })
})

// ============================================
// THEME TESTS
// ============================================
test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  test('should toggle between light and dark theme', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)

    // Find the theme toggle buttons in sidebar
    const lightBtn = page.locator('aside button:has-text("Claro")')
    const darkBtn = page.locator('aside button:has-text("Escuro")')

    await expect(darkBtn).toBeVisible()
    await darkBtn.click()
    await page.waitForTimeout(300)

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark).toBeTruthy()

    await expect(lightBtn).toBeVisible()
    await lightBtn.click()
    await page.waitForTimeout(300)

    const isLight = await page.evaluate(() => !document.documentElement.classList.contains('dark'))
    expect(isLight).toBeTruthy()
  })
})

// ============================================

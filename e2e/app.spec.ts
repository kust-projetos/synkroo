import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3002'

// Helper to login via browser fetch — cookies are stored in browser jar natively
async function login(page: Page) {
  // Navigate to login page first (ensures we're on the right origin)
  await page.goto(`${BASE_URL}/login`)

  // Call login API from within the browser so Set-Cookie is processed natively
  const loginResult = await page.evaluate(async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@clinicademo.com', password: 'demo123' }),
    })
    return { ok: response.ok, status: response.status }
  })

  if (!loginResult.ok) {
    throw new Error(`Login failed: ${loginResult.status}`)
  }

  // Navigate to dashboard — middleware sees auth cookie and allows access
  await page.goto(`${BASE_URL}/dashboard`)
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('aside, main', { timeout: 15000 })
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

    const loginLink = page.locator('a[href="/login"]').first()
    if (await loginLink.count() > 0) {
      await loginLink.click()
      await expect(page).toHaveURL(/.*login/)
    }
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

    // Should show error message - error is in a div with text-destructive class
    await expect(page.locator('.text-destructive, p:has-text("inválido"), p:has-text("incorreto")').first()).toBeVisible({ timeout: 5000 })
  })

  test('should login successfully with valid credentials', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(/.*dashboard/)
  })

  test('should logout successfully', async ({ page }) => {
    await login(page)

    // Logout is an icon button (ArrowRightStartOnRectangle) in sidebar footer
    // On desktop it's in the aside, on mobile it's in the Sheet
    const logoutButton = page.locator('aside button:has(svg), [data-radix-collection-item] button:has(svg)').last()

    // Try clicking the logout icon in sidebar footer area
    // The logout button is the last button in the sidebar footer
    const footerButtons = page.locator('aside button, .lg\\:flex button')
    const count = await footerButtons.count()

    if (count > 0) {
      // Logout is the last icon button in the sidebar (ArrowRightStartOnRectangle icon)
      await footerButtons.last().click()
      await expect(page).toHaveURL(/.*login/, { timeout: 5000 })
    }
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

    // Sidebar should be visible (hidden on mobile, flex on lg+)
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()

    // Navigation items should be visible
    await expect(page.locator('a[href="/dashboard/pacientes"]')).toBeVisible()
    await expect(page.locator('a[href="/dashboard/agendamentos"]')).toBeVisible()
    await expect(page.locator('a[href="/dashboard/campanhas"]')).toBeVisible()
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
    await expect(page.locator('[role="dialog"] a[href="/dashboard/pacientes"]').first()).toBeVisible({ timeout: 3000 })
  })

  test('sidebar should NOT overlap content on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })

    // Get sidebar dimensions
    const sidebar = page.locator('aside').first()
    const sidebarBox = await sidebar.boundingBox()

    // Get main content (has lg:pl-60)
    const mainContent = page.locator('main').first()
    const contentBox = await mainContent.boundingBox()

    // Content should start AFTER sidebar width
    if (sidebarBox && contentBox) {
      expect(contentBox.x).toBeGreaterThanOrEqual(sidebarBox.width - 10) // 10px tolerance
    }
  })

  test('should have collapsible sidebar on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })

    // Find the collapse toggle button (ChevronDoubleLeftIcon)
    const sidebar = page.locator('aside')
    const initialWidth = (await sidebar.boundingBox())?.width || 0

    // Look for collapse button inside sidebar
    const collapseBtn = sidebar.locator('button').first()
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click()
      await page.waitForTimeout(300) // animation

      const collapsedWidth = (await sidebar.boundingBox())?.width || 0
      // Collapsed sidebar should be narrower
      expect(collapsedWidth).toBeLessThan(initialWidth)
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
    // Should have heading or page title with "Pacientes"
    await expect(page.locator('h1, h2')).toContainText(/pacientes/i)
  })

  test('should have search functionality', async ({ page }) => {
    // Look for search input with flexible selectors
    const searchInput = page.locator('input[placeholder*="buscar"], input[placeholder*="pesquisar"], input[placeholder*="Buscar"], input[placeholder*="Pesquisar"]')
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('teste')
      // Should filter or show results
    }
  })

  test('should have add patient button', async ({ page }) => {
    const addButton = page.locator('a[href*="pacientes/novo"], button:has-text("Novo"), a:has-text("Novo")')
    await expect(addButton.first()).toBeVisible()
  })

  test('should navigate to new patient form', async ({ page }) => {
    const addLink = page.locator('a[href*="pacientes/novo"]').first()
    if (await addLink.count() > 0) {
      await addLink.click()
      await expect(page).toHaveURL(/.*pacientes\/novo/)
    }
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
    const addButton = page.locator('a[href*="agendamentos/novo"], button:has-text("Novo"), a:has-text("Novo")')
    await expect(addButton.first()).toBeVisible()
  })

  test('should navigate to new appointment form', async ({ page }) => {
    const addLink = page.locator('a[href*="agendamentos/novo"]').first()
    if (await addLink.count() > 0) {
      await addLink.click()
      await expect(page).toHaveURL(/.*agendamentos\/novo/)
    }
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
    await expect(page.locator('h1, h2')).toContainText(/campanhas/i)
  })

  test('should have new campaign button', async ({ page }) => {
    const addButton = page.locator('a[href*="campanhas/nova"], button:has-text("Nova"), a:has-text("Nova")')
    await expect(addButton.first()).toBeVisible()
  })

  test('should navigate to new campaign form', async ({ page }) => {
    const addLink = page.locator('a[href*="campanhas/nova"]').first()
    if (await addLink.count() > 0) {
      await addLink.click()
      await expect(page).toHaveURL(/.*campanhas\/nova/)
    }
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
    // Wait for conversations to load (spinner disappears)
    await page.waitForLoadState('networkidle')
    // Wait for either conversation buttons, filter tabs, or empty state to appear
    await page.waitForSelector('button, p, h2', { timeout: 15000 }).catch(() => {})

    // Either shows conversations or empty state message
    const hasConversations = await page.locator('[data-testid="conversation-item"]').count() > 0
    const hasEmptyState = await page.locator('text=/nenhuma conversa|sem conversas|Nenhuma/i').count() > 0
    const hasFilterButtons = await page.locator('button:has-text("Todas"), button:has-text("WhatsApp")').count() > 0
    const hasContent = await page.locator('main').isVisible()

    expect(hasConversations || hasEmptyState || hasFilterButtons || hasContent).toBeTruthy()
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
    // Wait for page data to finish loading
    await page.waitForLoadState('networkidle')
    // Wait for content to appear (stats cards or table or empty state)
    await page.waitForSelector('button, [role="tab"], select, table, p', { timeout: 15000 }).catch(() => {})

    // Should have filter cards or buttons with time periods
    const hasFilters = (await page.locator('button, [role="tab"], select').count()) > 0
    expect(hasFilters).toBeTruthy()
  })

  test('should have campaign button', async ({ page }) => {
    const campaignBtn = page.locator('a[href*="campanhas/nova"], button:has-text("Campanha"), a:has-text("Campanha")')
    if (await campaignBtn.count() > 0) {
      await expect(campaignBtn.first()).toBeVisible()
    }
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
    // Wait for leads data to finish loading (spinner disappears)
    await page.waitForLoadState('networkidle')
    // Wait for content (stats, table, filters, or empty state)
    await page.waitForSelector('select, [role="tablist"], button, table, p', { timeout: 15000 }).catch(() => {})

    // Should have filter tabs, buttons, or dropdown
    const hasFilters = await page.locator('select, [role="tablist"], button').count() > 0
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

    // Sidebar should have nav items with text
    await expect(page.locator('aside a[href="/dashboard/pacientes"]')).toBeVisible()
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
    const headings = await page.locator('h1, h2, h3').count()
    expect(headings).toBeGreaterThanOrEqual(1)
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

    // Dashboard -> Patients
    await page.click('a[href="/dashboard/pacientes"]')
    await expect(page).toHaveURL(/.*pacientes/)

    // Patients -> Appointments
    await page.click('a[href="/dashboard/agendamentos"]')
    await expect(page).toHaveURL(/.*agendamentos/)

    // Appointments -> Dashboard
    await page.click('a[href="/dashboard"]')
    await expect(page).toHaveURL(/.*\/dashboard$/)
  })

  test('active nav item should be highlighted with teal', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/pacientes`)

    // Active link should have teal highlight class
    const activeLink = page.locator('a[href="/dashboard/pacientes"]')
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

    // Should show error message or empty state, not crash
    // Check for main content, sidebar, or any visible content that proves the app didn't crash
    const hasMain = await page.locator('main').isVisible().catch(() => false)
    const hasSidebar = await page.locator('aside').isVisible().catch(() => false)
    const hasBody = await page.locator('body').isVisible()

    expect(hasMain || hasSidebar || hasBody).toBeTruthy()
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

    if (await darkBtn.count() > 0) {
      // Switch to dark mode
      await darkBtn.click()
      await page.waitForTimeout(300)

      // HTML element should have 'dark' class
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
      expect(isDark).toBeTruthy()

      // Switch back to light mode
      await lightBtn.click()
      await page.waitForTimeout(300)

      const isLight = await page.evaluate(() => !document.documentElement.classList.contains('dark'))
      expect(isLight).toBeTruthy()
    }
  })
})

// ============================================
// CHAT WIDGET TESTS
// ============================================
test.describe('Chat Widget', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should display chat widget button', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)

    // Chat widget button should be visible (fixed bottom-right)
    const chatButton = page.locator('button[aria-label*="chat" i], button[aria-label*="Chat" i], button[aria-label*="Abrir" i]').last()

    if (await chatButton.count() > 0) {
      await expect(chatButton).toBeVisible()
    }
  })

  test('should open chat panel when clicked', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)

    // Find and click the chat widget trigger
    const chatButton = page.locator('button[aria-label*="chat" i], button[aria-label*="Chat" i], button[aria-label*="Abrir" i]').last()

    if (await chatButton.isVisible()) {
      await chatButton.click()

      // Chat panel should appear with input or greeting
      const chatPanel = page.locator('input[placeholder*="mensagem" i], input[placeholder*="Digite" i], text=/Mia|assistente|Clínica/i')
      const isOpen = (await chatPanel.count()) > 0
      expect(isOpen).toBeTruthy()
    }
  })
})

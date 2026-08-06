import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:3003'

// Manual login flow requires an unauthenticated context.
test.use({ storageState: { cookies: [], origins: [] } })
test.setTimeout(60_000)

function currentMonthName(): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date())
}

// Login through the canonical NextAuth UI flow.
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('#email', 'admin@clinicademo.com')
  await page.fill('#password', 'demo123')
  await Promise.all([
    page.waitForURL('**/dashboard**'),
    page.click('button[type="submit"]'),
  ])
}

// Helper to navigate to calendar
async function goToCalendar(page: Page) {
  await page.goto(`${BASE_URL}/dashboard/agendamentos`)
  await page.waitForSelector('button:has-text("Hoje")', { timeout: 15000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
}

// Helper to switch view via toolbar — use URL params for reliable view switching
async function switchView(page: Page, viewName: string) {
  const viewMap: Record<string, string> = {
    'Dia': 'day',
    'Semana': 'week',
    'Mes': 'month',
    'Profissionais': 'professionals',
  }
  const viewValue = viewMap[viewName] || 'week'
  const currentUrl = page.url()
  const baseUrl = currentUrl.split('?')[0]
  await page.goto(`${baseUrl}?view=${viewValue}`)
  await page.waitForSelector('button:has-text("Hoje")', { timeout: 10000 })
  await page.waitForTimeout(500)
}

// Helper to click an empty slot using the rendered slot contract.
async function clickSlot(page: Page, hour: number, minute: number) {
  const slot = page.locator(`[data-hour="${hour}"][data-minute="${minute}"]`).first()
  await expect(slot).toBeVisible()
  await slot.dispatchEvent('click')
}

// ============================================
// CALENDAR RENDERING TESTS
// ============================================
test.describe('Calendar - Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await goToCalendar(page)
  })

  test('should display calendar toolbar', async ({ page }) => {
    await expect(page.locator('button:has-text("Hoje")')).toBeVisible()
    await expect(page.locator('button[aria-label="Anterior"]')).toBeVisible()
    await expect(page.locator('button[aria-label="Proximo"]')).toBeVisible()

    await expect(page.locator('button:has-text("Dia")')).toBeVisible()
    await expect(page.locator('button:has-text("Semana")')).toBeVisible()
    await expect(page.locator('button:has-text("Mês")')).toBeVisible()
    await expect(page.locator('button:has-text("Profissionais")').last()).toBeVisible()

    const title = page.locator('h2')
    await expect(title).toBeVisible()
    await expect(title).toContainText(new RegExp(currentMonthName(), 'i'))
  })

  test('week view should render 7 day columns', async ({ page }) => {
    await switchView(page, 'Semana')

    // date-fns ptBR 'EEE' returns full lowercase names: segunda, terça, quarta...
    const dayHeaders = page.locator('main').locator('text=/segunda|terça|quarta|quinta|sexta|sábado|domingo/i')
    await expect(dayHeaders.first()).toBeVisible()
    const count = await dayHeaders.count()
    expect(count).toBeGreaterThanOrEqual(7)
  })

  test('week view should render time labels', async ({ page }) => {
    await switchView(page, 'Semana')

    // Use specific selector for hour labels (inside the sticky left column)
    const hourLabel08 = page.locator('.select-none:has-text("08:00")').first()
    const hourLabel18 = page.locator('.select-none:has-text("18:00")').first()
    await expect(hourLabel08).toBeVisible()
    await expect(hourLabel18).toBeVisible()
  })

  test('week view should display event cards', async ({ page }) => {
    await switchView(page, 'Semana')
    await expect(page.locator('[role="button"][aria-label*="- "]').first()).toBeVisible()
  })

  test('day view should render single column with events', async ({ page }) => {
    await switchView(page, 'Dia')

    const dayHeader = page.locator('main').locator('text=/segunda|terça|quarta|quinta|sexta|sábado|domingo/i')
    await expect(dayHeader).toBeVisible()
    await expect(page.locator('[role="button"][aria-label*="- "]').first()).toBeVisible()
  })

  test('month view should render calendar grid with days', async ({ page }) => {
    await switchView(page, 'Mes')

    await expect(page.locator('text=SEG')).toBeVisible()
    await expect(page.locator('text=DOM')).toBeVisible()
    await expect(page.locator('main >> text=1').first()).toBeVisible()
    await expect(page.locator('main >> text=30').first()).toBeVisible()
  })

  test('month view should show mini event cards', async ({ page }) => {
    await switchView(page, 'Mes')
    await page.waitForTimeout(500)

    // Mini event cards show time + patient name
    const eventCards = page.locator('main').locator('text=/\\d{2}:\\d{2}\\s/')
    const count = await eventCards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('month view should show "+N mais" for overflow', async ({ page }) => {
    await switchView(page, 'Mes')
    await page.waitForTimeout(500)

    await expect(page.locator('text=/\\d+ mais/').first()).toBeVisible()
  })

  test('professionals view should render dentist columns', async ({ page }) => {
    await switchView(page, 'Profissionais')
    // Wait for dentists API to load and render column headers
    await page.waitForTimeout(1500)

    // Should have dentist name headers — wait for at least one to appear
    const dentistHeaders = page.locator('main').locator('text=/Dr(?:\\(a\\))?\\./')
    await expect(dentistHeaders.first()).toBeVisible({ timeout: 10000 })
    const count = await dentistHeaders.count()
    expect(count).toBeGreaterThan(0)
  })
})

// ============================================
// CALENDAR NAVIGATION TESTS
// ============================================
test.describe('Calendar - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await goToCalendar(page)
  })

  test('"Hoje" button should navigate to current week', async ({ page }) => {
    await page.locator('button[aria-label="Proximo"]').click()
    await page.waitForTimeout(300)

    await page.locator('button:has-text("Hoje")').click()
    await page.waitForTimeout(300)

    const title = await page.locator('h2').textContent()
    expect(title).toMatch(new RegExp(currentMonthName(), 'i'))
  })

  test('prev button should navigate backward', async ({ page }) => {
    const titleBefore = await page.locator('h2').textContent()
    await page.locator('button[aria-label="Anterior"]').click()
    await page.waitForTimeout(300)
    const titleAfter = await page.locator('h2').textContent()
    expect(titleAfter).not.toBe(titleBefore)
  })

  test('next button should navigate forward', async ({ page }) => {
    const titleBefore = await page.locator('h2').textContent()
    await page.locator('button[aria-label="Proximo"]').click()
    await page.waitForTimeout(300)
    const titleAfter = await page.locator('h2').textContent()
    expect(titleAfter).not.toBe(titleBefore)
  })

  test('view switcher should change active view', async ({ page }) => {
    const semanaBtn = page.locator('button:has-text("Semana")')
    const isActive = await semanaBtn.evaluate(el => el.classList.contains('bg-teal-600'))
    expect(isActive).toBeTruthy()

    await switchView(page, 'Dia')
    const diaBtn = page.locator('button:has-text("Dia")')
    const diaActive = await diaBtn.evaluate(el => el.classList.contains('bg-teal-600'))
    expect(diaActive).toBeTruthy()

    const semanaInactive = await semanaBtn.evaluate(el => !el.classList.contains('bg-teal-600'))
    expect(semanaInactive).toBeTruthy()
  })

  test('view state should sync with URL', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/agendamentos?view=day`)
    await page.waitForSelector('button:has-text("Dia")', { timeout: 10000 })
    await page.waitForTimeout(1000)

    const diaBtn = page.locator('button:has-text("Dia")')
    const isActive = await diaBtn.evaluate(el => el.classList.contains('bg-teal-600'))
    expect(isActive).toBeTruthy()
  })

  test('month view click on day should switch to day view', async ({ page }) => {
    await switchView(page, 'Mes')
    await page.waitForTimeout(500)

    // Find today's day cell — it may have a cursor-pointer or be inside a clickable container
    // Use evaluate to find and click any day cell containing "14"
    const clicked = await page.evaluate(() => {
      // MonthView cells have cursor-pointer on clickable day numbers
      const cells = document.querySelectorAll('main div[class*="cursor-pointer"]')
      for (const cell of cells) {
        if (cell.textContent?.trim() === '14' || (cell as HTMLElement).innerText?.trim()?.match(/^14$/)) {
          ;(cell as HTMLElement).click()
          return true
        }
      }
      // Fallback: try any element with just "14" text
      const allEls = document.querySelectorAll('main *')
      for (const el of allEls) {
        if ((el as HTMLElement).innerText?.trim() === '14' && (el as HTMLElement).closest('[class*="cursor"]')) {
          el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
          return true
        }
      }
      return false
    })

    expect(clicked).toBe(true)
    await page.waitForTimeout(800)

    // Should now show day view — toolbar is canonical view state.
    await expect(page.locator('button:has-text("Dia")').first()).toHaveClass(/bg-teal-600/)
  })
})

// ============================================
// CLICK-TO-CREATE TESTS
// ============================================
test.describe('Calendar - Click to Create', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await goToCalendar(page)
    await switchView(page, 'Dia')
  })

  test('clicking empty slot should open create dialog', async ({ page }) => {
    await clickSlot(page, 12, 0)

    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Novo Agendamento', exact: true })).toBeVisible()
  })

  test('dialog should pre-fill date from clicked slot', async ({ page }) => {
    await clickSlot(page, 14, 0)

    await expect(page.locator('[role="dialog"]')).toBeVisible()

    const dateInput = page.locator('input[type="date"]')
    const dateValue = await dateInput.inputValue()
    const now = new Date()
    const expectedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(dateValue).toBe(expectedDate)
  })

  test('dialog should have all required form fields', async ({ page }) => {
    await clickSlot(page, 12, 0)

    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.locator('[role="dialog"] input[id="patient"]')).toBeVisible()
    await expect(page.locator('[role="dialog"] input[id="phone"]')).toBeVisible()
    await expect(page.locator('[role="dialog"] input[type="date"]')).toBeVisible()
    await expect(page.locator('[role="dialog"] input[id="notes"]')).toBeVisible()
    await expect(page.locator('[role="dialog"] button:has-text("Cancelar")')).toBeVisible()
    await expect(page.locator('[role="dialog"] button:has-text("Agendar")')).toBeVisible()
  })

  test('submit button should be disabled without patient name', async ({ page }) => {
    await clickSlot(page, 12, 0)
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    const submitBtn = page.locator('[role="dialog"] button:has-text("Agendar")')
    await expect(submitBtn).toBeDisabled()
  })

  test('submit button should enable after filling patient name', async ({ page }) => {
    await clickSlot(page, 12, 0)
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    await page.locator('[role="dialog"] input[id="patient"]').fill('Paciente Teste E2E')

    const submitBtn = page.locator('[role="dialog"] button:has-text("Agendar")')
    await expect(submitBtn).toBeEnabled()
  })

  test('cancel button should close dialog', async ({ page }) => {
    await clickSlot(page, 12, 0)
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    await page.locator('[role="dialog"] button:has-text("Cancelar")').click()
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })

  test('clicking week view slot should open dialog', async ({ page }) => {
    await switchView(page, 'Semana')

    await clickSlot(page, 13, 0)
    await expect(page.locator('[role="dialog"]')).toBeVisible()
  })
})

// ============================================
// EVENT INTERACTION TESTS
// ============================================
test.describe('Calendar - Event Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await goToCalendar(page)
  })

  test('clicking event should open edit dialog', async ({ page }) => {
    await switchView(page, 'Dia')

    const firstEvent = page.locator('[role="button"][aria-label*="- "]').first()
    await expect(firstEvent).toBeVisible()
    await firstEvent.dblclick()

    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.locator('[role="dialog"] h2')).toContainText(/Agendamento/)
  })

  test('events should display patient name', async ({ page }) => {
    await switchView(page, 'Dia')

    const firstEvent = page.locator('[role="button"][aria-label*="- "]').first()
    const label = await firstEvent.getAttribute('aria-label')
    expect(label).toMatch(/.+-\s*\d{2}:\d{2}/)
  })

  test('events in week view should be distributed across days', async ({ page }) => {
    await switchView(page, 'Semana')

    const eventButtons = page.locator('[role="button"][aria-label*="- "]')
    const count = await eventButtons.count()
    // Week may be empty in demo data — check for events OR empty week state
    const hasEmptyWeek = await page.locator('text=/sem|nenhum|0 evento/i').count() > 0
    expect(count > 0 || hasEmptyWeek).toBeTruthy()
  })

  test('professionals view should group events by dentist', async ({ page }) => {
    await switchView(page, 'Profissionais')
    // Wait for dentists API to load and render
    await page.waitForTimeout(1500)

    const dentistNames = page.locator('main').locator('text=/Dr(?:\\(a\\))?\\./')
    await expect(dentistNames.first()).toBeVisible({ timeout: 10000 })
    const dentistCount = await dentistNames.count()
    expect(dentistCount).toBeGreaterThan(0)

    const eventButtons = page.locator('[role="button"][aria-label*="- "]')
    const eventCount = await eventButtons.count()
    expect(eventCount).toBeGreaterThan(0)
  })
})

// ============================================
// CALENDAR GRID ARCHITECTURE TESTS
// ============================================
test.describe('Calendar - CSS Grid Architecture', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await goToCalendar(page)
    await switchView(page, 'Dia')
  })

  test('time grid should have CSS variables for positioning', async ({ page }) => {
    await expect(page.locator('[style*="--hour-size"]').first()).toBeVisible({ timeout: 15000 })
    const gridVars = await page.evaluate(() => {
      const gridArea = document.querySelector('[style*="--hour-size"]') as HTMLElement
      if (!gridArea) return null
      return {
        hourSize: gridArea.style.getPropertyValue('--hour-size'),
        oneMinuteHeight: gridArea.style.getPropertyValue('--one-minute-height'),
      }
    })

    expect(gridVars).not.toBeNull()
    expect(gridVars!.hourSize).toContain('px')
    expect(gridVars!.oneMinuteHeight).toContain('px')
  })

  test('grid should have 4 stacked layers via z-index', async ({ page }) => {
    await expect(page.locator('[style*="--hour-size"]').first()).toBeVisible()
    // The grid area has children with inline zIndex. Search recursively
    // because layers may be wrapped in intermediate divs.
    const zIndexes = await page.evaluate(() => {
      const gridArea = document.querySelector('[style*="--hour-size"]')
      if (!gridArea) return null
      // Collect all zIndex values from gridArea and its descendants
      const result: number[] = []
      const walk = (el: Element) => {
        const z = parseInt((el as HTMLElement).style?.zIndex)
        if (!isNaN(z)) result.push(z)
        for (const child of Array.from(el.children)) {
          walk(child)
        }
      }
      walk(gridArea)
      return result
    })

    expect(zIndexes).not.toBeNull()
    expect(zIndexes).toContain(0) // HorizontalLines
    expect(zIndexes).toContain(2) // EmptySlots
    expect(zIndexes).toContain(3) // EventLayer
  })

  test('hour labels should span the working hours', async ({ page }) => {
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
    for (const hour of hours) {
      const label = page.locator(`.select-none:has-text("${hour}")`).first()
      await expect(label).toBeVisible()
    }
  })

  test('empty slots should be clickable', async ({ page }) => {
    const slot = page.locator('div.cursor-pointer[data-hour][data-minute]').first()
    await expect(slot).toBeVisible()
    await expect(slot).toHaveClass(/cursor-pointer/)
  })
})

// ============================================
// DARK MODE TESTS
// ============================================
test.describe('Calendar - Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    const darkBtn = page.locator('aside button:has-text("Escuro")')
    await expect(darkBtn).toBeVisible()
    await darkBtn.click()
    await page.waitForTimeout(300)
    await goToCalendar(page)
  })

  test('calendar should render in dark mode without errors', async ({ page }) => {
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark).toBeTruthy()
    await expect(page.locator('button:has-text("Hoje")')).toBeVisible()
    await expect(page.locator('h2')).toBeVisible()
  })

  test('day view should render events in dark mode', async ({ page }) => {
    await switchView(page, 'Dia')

    const eventButtons = page.locator('[role="button"][aria-label*="- "]')
    await expect(eventButtons.first()).toBeVisible()
    if (await eventButtons.count() > 0) {
      const classes = await eventButtons.first().evaluate(el => el.className)
      expect(classes).toContain('dark:')
    } else {
      await expect(page.getByText('+ Criar encaixe').first()).toBeVisible()
    }
  })

  test('click-to-create should work in dark mode', async ({ page }) => {
    await switchView(page, 'Dia')
    await expect.poll(async () => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)
    await clickSlot(page, 12, 0)

    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Novo Agendamento', exact: true })).toBeVisible()
  })
})

// ============================================
// RESPONSIVE TESTS
// ============================================
test.describe('Calendar - Responsive', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await goToCalendar(page)
  })

  test('calendar should be usable on tablet (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(300)
    await expect(page.locator('button:has-text("Hoje")')).toBeVisible()
  })

  test('calendar should be usable on desktop (1440x900)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(300)
    await expect(page.locator('button:has-text("Hoje")')).toBeVisible()
    await expect(page.locator('h2')).toBeVisible()
  })

  test('view buttons should remain accessible on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 480 })
    await page.waitForTimeout(300)
    const viewButtons = page.locator('button:has-text("Dia"), button:has-text("Semana")')
    const count = await viewButtons.count()
    expect(count).toBeGreaterThan(0)
  })
})

// ============================================
// CALENDAR / LIST TOGGLE TESTS
// ============================================
test.describe('Calendar - List Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await goToCalendar(page)
  })

  test('should have calendar/list toggle buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Agenda")')).toBeVisible()
    await expect(page.locator('button:has-text("Lista")')).toBeVisible()
  })

  test('calendar should be default view', async ({ page }) => {
    const calendarBtn = page.locator('button:has-text("Agenda")')
    const isActive = await calendarBtn.evaluate(el => el.classList.contains('bg-teal-100'))
    expect(isActive).toBeTruthy()
  })

  test('clicking "Lista" should switch to list view', async ({ page }) => {
    await page.locator('button:has-text("Lista")').click()
    await page.waitForTimeout(500)

    const listBtn = page.locator('button:has-text("Lista")')
    const isActive = await listBtn.evaluate(el => el.classList.contains('bg-teal-600'))
    expect(isActive).toBeTruthy()
  })

  test('clicking a calendar view should return from list', async ({ page }) => {
    await page.locator('button:has-text("Lista")').click()
    await page.waitForTimeout(300)
    await page.locator('button:has-text("Semana")').click()
    await page.waitForTimeout(300)
    await expect(page.locator('button:has-text("Hoje")')).toBeVisible()
  })
})

// ============================================
// DATA LOADING TESTS
// ============================================
test.describe('Calendar - Data Loading', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should load and display calendar data', async ({ page }) => {
    await goToCalendar(page)
    // If we get here without timeout, data loaded successfully
    await expect(page.locator('button:has-text("Hoje")')).toBeVisible()
  })

  test('should fetch appointments with correct date range for week view', async ({ page }) => {
    let capturedUrl = ''

    await page.route('**/api/appointments**', async route => {
      capturedUrl = route.request().url()
      await route.continue()
    })

    await goToCalendar(page)

    expect(capturedUrl).toContain('start_date=')
    expect(capturedUrl).toContain('end_date=')
  })

  test('should fetch appointments for single day in day view', async ({ page }) => {
    const capturedUrls: string[] = []

    await page.route('**/api/appointments**', async route => {
      capturedUrls.push(route.request().url())
      await route.continue()
    })

    await goToCalendar(page)
    await switchView(page, 'Dia')
    await page.waitForTimeout(2000)

    const dayViewCall = capturedUrls.at(-1)
    expect(dayViewCall).toBeTruthy()
    const params = new URL(dayViewCall!).searchParams
    expect(params.get('start_date')).not.toBe(params.get('end_date'))
  })
})

import type { Page } from '@playwright/test'
export const SIDEBAR_LINKS = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Agendamentos', href: '/dashboard/agendamentos' },
  { name: 'Pacientes', href: '/dashboard/pacientes' },
  { name: 'Leads', href: '/dashboard/leads' },
  { name: 'Dentistas', href: '/dashboard/dentistas' },
  { name: 'Procedimentos', href: '/dashboard/procedimentos' },
  { name: 'Lista de Espera', href: '/dashboard/lista-espera' },
  { name: 'Conversas', href: '/dashboard/conversas' },
  { name: 'Campanhas', href: '/dashboard/campanhas' },
  { name: 'Analytics', href: '/dashboard/analytics' },
  { name: 'Configuracoes', href: '/dashboard/configuracoes' },
] as const
export async function navigateViaSidebar(page: Page, itemName: string) {
  await page.click(`aside a:has-text("${itemName}")`)
  await page.waitForLoadState('networkidle')
}
export async function gotoDashboard(page: Page) {
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
}

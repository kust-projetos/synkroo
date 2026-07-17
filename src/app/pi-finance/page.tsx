/**
 * Public route /pi-finance — self-contained Pi Financeiro clone.
 * Stays outside the Synkroo clinic-financial domain: no DB, no auth, no
 * sidebar — localStorage only.
 */
import type { Metadata } from 'next'
import { PiFinanceApp } from '@/components/pi-finance/pi-finance-app'

export const metadata: Metadata = {
  title: 'Pi Financeiro',
  description: 'Gestao financeira pessoal self-contained (localStorage).',
  robots: { index: false, follow: false },
}

export default function PiFinancePage() {
  return <PiFinanceApp />
}

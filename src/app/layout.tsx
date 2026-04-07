import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Synkroo - Automação Inteligente para Clínicas',
  description: 'Atenda pacientes 24/7, reduza no-shows e aumente sua receita com IA conversacional.',
  keywords: ['odontologia', 'automação', 'whatsapp', 'agendamento', 'IA', 'clínica'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
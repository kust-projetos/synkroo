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
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Shim para scripts gerados por esbuild/next-themes que referenciam
            __name no escopo global no Cloudflare Workers (ReferenceError:
            __name is not defined). Preserva implementacao existente se houver. */}
        <script
          dangerouslySetInnerHTML={{
            __html: 'window.__name=window.__name||function(t,v){return t};',
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
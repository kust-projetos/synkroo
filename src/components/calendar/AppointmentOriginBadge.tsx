import type { AppointmentOrigin } from './utils/types'

export function AppointmentOriginBadge({ origin }: { origin?: AppointmentOrigin }) {
  if (!origin) return null

  const label = origin === 'ai' ? 'IA' : 'Manual'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
        origin === 'ai'
          ? 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/30 dark:text-violet-200'
          : 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200'
      }`}
    >
      {label}
    </span>
  )
}

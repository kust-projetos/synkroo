// Event card styles — CVA variants by appointment status

import { cva, type VariantProps } from 'class-variance-authority'

export const eventCardVariants = cva(
  'rounded-sm px-1.5 py-0.5 text-[12px] leading-tight cursor-pointer border-l-[3px] overflow-hidden transition-opacity hover:opacity-90',
  {
    variants: {
      status: {
        scheduled: 'bg-amber-100 border-amber-500 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200',
        confirmed: 'bg-blue-50 border-blue-400 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
        in_progress: 'bg-teal-50 border-teal-400 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200',
        completed: 'bg-green-50 border-green-400 text-green-900 dark:bg-green-950/40 dark:text-green-200',
        cancelled: 'bg-red-50 border-red-400 text-red-900 dark:bg-red-950/40 dark:text-red-200 line-through opacity-60',
        no_show: 'bg-zinc-100 border-zinc-400 text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400',
        blocked: 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-900/40 dark:text-gray-500',
        unavailable: 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-900/40 dark:text-gray-500',
      },
    },
    defaultVariants: {
      status: 'scheduled',
    },
  }
)

export type EventCardVariantProps = VariantProps<typeof eventCardVariants>

/** Status labels in Portuguese */
export const statusLabels: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  in_progress: 'Em andamento',
  completed: 'Concluido',
  cancelled: 'Cancelado',
  no_show: 'Nao compareceu',
  blocked: 'Bloqueado',
  unavailable: 'Indisponivel',
}

/** Status icon colors (for tooltip/legend) */
export const statusDotColors: Record<string, string> = {
  scheduled: 'bg-amber-400',
  confirmed: 'bg-blue-400',
  in_progress: 'bg-teal-400',
  completed: 'bg-green-400',
  cancelled: 'bg-red-400',
  no_show: 'bg-zinc-400',
  blocked: 'bg-gray-400',
  unavailable: 'bg-gray-400',
}

/** Drag preview styles by status — dashed border + translucent bg */
export const dragPreviewStatusStyles: Record<string, string> = {
  scheduled: 'border-amber-400 border-dashed bg-amber-50/90 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200',
  confirmed: 'border-blue-400 border-dashed bg-blue-50/90 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200',
  in_progress: 'border-teal-400 border-dashed bg-teal-50/90 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200',
  completed: 'border-green-400 border-dashed bg-green-50/90 dark:bg-green-950/60 text-green-800 dark:text-green-200',
  cancelled: 'border-red-400 border-dashed bg-red-50/90 dark:bg-red-950/60 text-red-800 dark:text-red-200',
  no_show: 'border-zinc-400 border-dashed bg-zinc-50/90 dark:bg-zinc-900/60 text-zinc-800 dark:text-zinc-200',
  blocked: 'border-gray-400 border-dashed bg-gray-50/90 dark:bg-gray-900/60 text-gray-800 dark:text-gray-200',
  unavailable: 'border-gray-400 border-dashed bg-gray-50/90 dark:bg-gray-900/60 text-gray-800 dark:text-gray-200',
}

// EmptySlots — z-index 2 layer with clickable time slots for creating appointments

import { useCallback } from 'react'
import { HOUR_SIZE, SLOT_HEIGHT, SLOTS_PER_HOUR } from '../utils/date-utils'
import { useCalendarStore } from '../store/calendar-store'

interface EmptySlotsProps {
  /** Number of grid columns */
  columnCount: number
  /** Dates for each column (YYYY-MM-DD). If single date, used for all columns. */
  dates: string[]
  /** Optional: map column index to a dentist ID (for professionals view) */
  columnDentistIds?: string[]
}

export function EmptySlots({ columnCount, dates, columnDentistIds }: EmptySlotsProps) {
  const openCreateDialog = useCalendarStore((s) => s.openCreateDialog)
  const startHour = useCalendarStore((s) => s.startHour)
  const endHour = useCalendarStore((s) => s.endHour)
  const hours: number[] = []
  for (let h = startHour; h < endHour; h++) hours.push(h)

  const handleSlotClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.currentTarget
      const date = target.dataset.date
      const hour = parseInt(target.dataset.hour || '0', 10)
      const minute = parseInt(target.dataset.minute || '0', 10)
      const col = parseInt(target.dataset.col || '0', 10)

      if (!date) return

      const slotDate = new Date(date + 'T00:00:00')
      openCreateDialog({
        date: slotDate,
        hour,
        minute,
        dentistId: columnDentistIds?.[col],
      })
    },
    [openCreateDialog, columnDentistIds],
  )

  const slots: React.ReactNode[] = []

  for (let col = 0; col < columnCount; col++) {
    for (let h = 0; h < hours.length; h++) {
      for (let s = 0; s < SLOTS_PER_HOUR; s++) {
        const hour = hours[h]
        const minute = s * 15
        const top = (h * SLOTS_PER_HOUR + s) * SLOT_HEIGHT

        slots.push(
          <div
            key={`${col}-${hour}-${minute}`}
            data-col={col}
            data-date={dates[col % dates.length]}
            data-hour={hour}
            data-minute={minute}
            className="absolute cursor-pointer hover:bg-teal-50/50 dark:hover:bg-teal-950/20 transition-colors group/slot"
            style={{
              top,
              height: SLOT_HEIGHT,
              left: `${(col / columnCount) * 100}%`,
              width: `${100 / columnCount}%`,
            }}
            onClick={handleSlotClick}
          >
            <span className="opacity-0 group-hover/slot:opacity-100 text-xs text-teal-600 dark:text-teal-400 font-medium absolute inset-0 flex items-center justify-center transition-opacity">
              + Criar encaixe
            </span>
          </div>
        )
      }
    }
  }

  return <>{slots}</>
}

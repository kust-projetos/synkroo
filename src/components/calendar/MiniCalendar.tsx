// src/components/calendar/MiniCalendar.tsx
'use client'

import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface MiniCalendarProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
}

export function MiniCalendar({ selectedDate, onSelectDate }: MiniCalendarProps) {
  const validDate = selectedDate instanceof Date && !isNaN(selectedDate.getTime()) ? selectedDate : new Date()
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(validDate))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="p-1 rounded hover:bg-muted">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 rounded hover:bg-muted">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {/* Day labels for weekStartsOn: 1 (Monday-first). Order: S=Segunda, T=Terça, Q=Quarta, Q=Quinta, S=Sexta, S=Sábado, D=Domingo */}
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
          <div key={i} className="text-[10px] text-muted-foreground py-1">{d}</div>
        ))}
        {days.map((d, i) => {
          const inMonth = isSameMonth(d, currentMonth)
          const selected = isSameDay(d, selectedDate)
          const today = isToday(d)
          return (
            <button
              key={i}
              onClick={() => onSelectDate(d)}
              className={`
                text-xs py-1 rounded-sm transition-colors
                ${!inMonth ? 'text-muted-foreground/40' : 'text-foreground'}
                ${selected ? 'bg-teal-600 text-white font-semibold' : 'hover:bg-muted'}
                ${today && !selected ? 'ring-1 ring-teal-400' : ''}
              `}
            >
              {format(d, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

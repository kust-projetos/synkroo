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
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate))

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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold capitalize text-foreground">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <div className="flex gap-0.5">
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {/* Day labels for weekStartsOn: 1 (Monday-first). Order: S=Segunda, T=Terça, Q=Quarta, Q=Quinta, S=Sexta, S=Sábado, D=Domingo */}
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
          <div key={i} className="text-[10px] font-medium text-muted-foreground py-1">{d}</div>
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
                text-xs py-1.5 rounded-md transition-all
                ${!inMonth ? 'text-muted-foreground/40' : 'text-foreground'}
                ${selected
                  ? 'bg-teal-600 text-white font-semibold shadow-sm'
                  : 'hover:bg-muted'
                }
                ${today && !selected ? 'ring-1 ring-teal-400 font-medium' : ''}
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

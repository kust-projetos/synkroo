import { isToday, format } from '../../utils/date-utils'
import { ptBR } from 'date-fns/locale'

interface DayHeaderProps {
  date: Date
  isWeekend?: boolean
}

export function DayHeader({ date, isWeekend = false }: DayHeaderProps) {
  const today = isToday(date)
  const weekday = format(date, 'EEE', { locale: ptBR }).toUpperCase()
  const dayNum = format(date, 'd')

  if (today) {
    return (
      <div className="h-12 px-3 text-center text-xs font-semibold text-primary bg-primary/5 border-b-2 border-primary flex items-center justify-center">
        {weekday} {dayNum}
      </div>
    )
  }

  if (isWeekend) {
    return (
      <div className="h-12 px-3 text-center text-xs font-semibold text-primary bg-primary/5 border-b border-border flex items-center justify-center">
        {weekday} {dayNum}
      </div>
    )
  }

  return (
    <div className="h-12 px-3 text-center text-xs font-semibold text-foreground bg-muted/50 border-b border-border flex items-center justify-center">
      {weekday} {dayNum}
    </div>
  )
}

// NowIndicator — red line showing current time position (auto-updates every 60s)

import { useState, useEffect } from 'react'
import { HOUR_SIZE, MINUTE_HEIGHT, isToday } from '../utils/date-utils'

interface NowIndicatorProps {
  date: Date
  startHour: number
  endHour: number
}

export function NowIndicator({ date, startHour, endHour }: NowIndicatorProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(timer)
  }, [])

  if (!isToday(date)) return null

  const now = new Date()
  const minutesFromStart = (now.getHours() - startHour) * 60 + now.getMinutes()

  // Don't show if outside calendar hours
  if (now.getHours() < startHour || now.getHours() >= endHour) {
    return null
  }

  const top = minutesFromStart * MINUTE_HEIGHT

  return (
    <div
      className="absolute left-0 right-0 pointer-events-none"
      style={{ top, zIndex: 20 }}
    >
      {/* Dot */}
      <div className="absolute -left-1 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
      {/* Line */}
      <div className="absolute left-0 right-0 h-0.5 bg-red-500" />
    </div>
  )
}

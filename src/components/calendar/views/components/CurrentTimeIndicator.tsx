'use client'

import { useEffect, useState } from 'react'
import { isToday } from '../../utils/date-utils'

interface CurrentTimeIndicatorProps {
  slotHeight?: number
}

export function CurrentTimeIndicator({ slotHeight = 80 }: CurrentTimeIndicatorProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const hours = now.getHours()
  const minutes = now.getMinutes()
  const hourHeight = slotHeight / 60
  const top = (hours * slotHeight) + (minutes * hourHeight)

  if (!isToday(now)) return null

  return <div className="ec-now-indicator" style={{ top: `${top}px` }} />
}

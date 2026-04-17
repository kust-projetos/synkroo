// useAutoScroll — scroll to current hour on mount

import { useEffect, useRef } from 'react'
import { HOUR_SIZE, DAY_START_HOUR } from '../utils/date-utils'

/**
 * Scrolls the calendar container to show the current hour.
 * Positions the viewport ~1 hour above the current time.
 */
export function useAutoScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const now = new Date()
    const currentHour = now.getHours()

    // Only scroll if current hour is within calendar range
    if (currentHour >= DAY_START_HOUR && currentHour <= DAY_START_HOUR + 11) {
      // Scroll to 1 hour above current time
      const targetHour = Math.max(DAY_START_HOUR, currentHour - 1)
      const scrollTarget = (targetHour - DAY_START_HOUR) * HOUR_SIZE

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        el.scrollTo({ top: scrollTarget, behavior: 'smooth' })
      })
    }
  }, [])

  return ref
}

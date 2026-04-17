// Calendar barrel exports

// Layout
export { CalendarLayout } from './CalendarLayout'

// Store
export { useCalendarStore } from './store/calendar-store'

// Types
export type {
  CalendarEvent,
  CalendarResource,
  CalendarView,
  DialogSlotInfo,
  DialogState,
  LaidOutEvent,
  TimeGridViewProps,
} from './utils/types'

// Utils
export {
  HOURS,
  HOUR_SIZE,
  SLOT_MINUTES,
  SLOTS_PER_HOUR,
  SLOT_HEIGHT,
  MINUTE_HEIGHT,
  DAY_START_HOUR,
  DAY_END_HOUR,
  getMinutesFromMidnight,
  getMinutesFromDayStart,
  getPixelOffset,
  getPixelHeight,
  formatDateKey,
  getWeekDays,
  getMonthDays,
  formatTitle,
  formatHourLabel,
  formatTime,
  isToday,
  isWeekend,
  getShortDayName,
  getDayNumber,
} from './utils/date-utils'

export { getDentistColors, getDentistDotColor, getDentistPalette } from './utils/dentist-colors'

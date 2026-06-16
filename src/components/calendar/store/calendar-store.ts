// Zustand store for calendar state — URL sync + internal state

import { create } from 'zustand'
import { startOfDay } from 'date-fns'
import { getNextDate, getPrevDate } from '../utils/date-utils'
import type { CalendarView, CalendarGroupMode, CalendarDensityMode, CalendarLayoutMode, DialogState, DialogSlotInfo, RescheduleInfo } from '../utils/types'

/** Default business hours for a dental clinic */
const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 22

interface CalendarStore {
  // State
  view: CalendarView
  selectedDate: Date
  dentistFilter: string[]
  dialog: DialogState
  /** Clinic business hours — start hour (e.g. 8 for 08:00) */
  startHour: number
  /** Clinic business hours — end hour (e.g. 18 for 18:00) */
  endHour: number

  // Scaling state for professionals view
  groupMode: CalendarGroupMode
  densityMode: CalendarDensityMode

  // Actions
  setView: (view: CalendarView) => void
  setSelectedDate: (date: Date) => void
  goToday: () => void
  goNext: () => void
  goPrev: () => void
  toggleDentistFilter: (dentistId: string) => void
  clearDentistFilter: () => void
  openCreateDialog: (slotInfo: DialogSlotInfo) => void
  openEditDialog: (eventId: string) => void
  openRescheduleDialog: (info: RescheduleInfo) => void
  closeDialog: () => void
  setBusinessHours: (startHour: number, endHour: number) => void
  prefillFromPatient: (patientId: string) => void
  prefillFromLead: (name: string, phone: string) => void
  clearPrefill: () => void

  // Scaling actions
  setGroupMode: (mode: CalendarGroupMode) => void
  setDensityMode: (mode: CalendarDensityMode) => void

  // Layout mode
  layoutMode: CalendarLayoutMode
  setLayoutMode: (mode: CalendarLayoutMode) => void

  // URL sync
  syncFromURL: (params: URLSearchParams) => void
  toSearchParams: () => URLSearchParams
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  // Initial state
  view: 'week',
  selectedDate: startOfDay(new Date()),
  dentistFilter: [],
  dialog: { open: false, mode: 'create' },
  startHour: DEFAULT_START_HOUR,
  endHour: DEFAULT_END_HOUR,
  groupMode: 'professionals',
  densityMode: 'comfortable',
  layoutMode: 'agenda',

  // Actions
  setView: (view) => {
    set({ view })
  },

  setSelectedDate: (date) => {
    set({ selectedDate: startOfDay(date) })
  },

  goToday: () => {
    set({ selectedDate: startOfDay(new Date()) })
  },

  goNext: () => {
    set((state) => ({
      selectedDate: startOfDay(getNextDate(state.selectedDate, state.view)),
    }))
  },

  goPrev: () => {
    set((state) => ({
      selectedDate: startOfDay(getPrevDate(state.selectedDate, state.view)),
    }))
  },

  toggleDentistFilter: (dentistId) => {
    set((state) => {
      const exists = state.dentistFilter.includes(dentistId)
      return {
        dentistFilter: exists
          ? state.dentistFilter.filter((id) => id !== dentistId)
          : [...state.dentistFilter, dentistId],
      }
    })
  },

  clearDentistFilter: () => {
    set({ dentistFilter: [] })
  },

  openCreateDialog: (slotInfo) => {
    set({ dialog: { open: true, mode: 'create', slotInfo } })
  },

  openEditDialog: (eventId) => {
    set({ dialog: { open: true, mode: 'edit', eventId } })
  },

  openRescheduleDialog: (info) => {
    set({ dialog: { open: true, mode: 'reschedule', rescheduleInfo: info } })
  },

  closeDialog: () => {
    set({ dialog: { open: false, mode: 'create' } })
  },

  prefillFromPatient: (patientId) => {
    set({ dialog: { open: true, mode: 'create', defaultPatientId: patientId } })
  },

  prefillFromLead: (name, phone) => {
    set({ dialog: { open: true, mode: 'create', defaultLeadName: name, defaultLeadPhone: phone } })
  },

  clearPrefill: () => {
    set((state) => ({
      dialog: {
        ...state.dialog,
        defaultPatientId: undefined,
        defaultLeadName: undefined,
        defaultLeadPhone: undefined,
      },
    }))
  },

  setGroupMode: (groupMode) => {
    set({ groupMode })
  },

  setDensityMode: (densityMode) => {
    set({ densityMode })
  },

  setLayoutMode: (layoutMode) => {
    set({ layoutMode })
  },

  setBusinessHours: (startHour, endHour) => {
    if (startHour >= 0 && startHour < 24 && endHour > startHour && endHour <= 24) {
      set({ startHour, endHour })
    }
  },

  // URL sync — read state from URL params
  syncFromURL: (params) => {
    const view = params.get('view') as CalendarView | null
    const date = params.get('date')
    const dentists = params.getAll('dentist')

    const updates: Partial<CalendarStore> = {}
    if (view && ['day', 'week', 'month', 'professionals', 'list'].includes(view)) {
      updates.view = view
    }
    if (date) {
      const parsed = new Date(date + 'T12:00:00')
      if (!isNaN(parsed.getTime())) {
        updates.selectedDate = startOfDay(parsed)
      }
    }
    if (dentists.length > 0) {
      updates.dentistFilter = dentists
    }

    if (Object.keys(updates).length > 0) {
      set(updates)
    }
  },

  // URL sync — write state to URL params
  toSearchParams: () => {
    const state = get()
    const params = new URLSearchParams()
    if (state.view !== 'week') params.set('view', state.view)
    const today = new Date()
    const dateKey = state.selectedDate.toISOString().split('T')[0]
    if (dateKey !== today.toISOString().split('T')[0]) {
      params.set('date', dateKey)
    }
    state.dentistFilter.forEach((id) => params.append('dentist', id))
    return params
  },
}))

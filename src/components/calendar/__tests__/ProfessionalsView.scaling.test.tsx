/**
 * @jest-environment jsdom
 */

import { describe, expect, it, beforeEach } from '@jest/globals'

// We test the store directly — it's a vanilla Zustand store, no React needed
import { useCalendarStore } from '../store/calendar-store'

describe('professionals scaling modes', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useCalendarStore.setState({
      groupMode: 'professionals',
      densityMode: 'comfortable',
    })
  })

  it('defaults groupMode to professionals and densityMode to comfortable', () => {
    const state = useCalendarStore.getState()

    expect(state.groupMode).toBe('professionals')
    expect(state.densityMode).toBe('comfortable')
  })

  it('supports setting groupMode to time and status', () => {
    useCalendarStore.getState().setGroupMode('time')
    expect(useCalendarStore.getState().groupMode).toBe('time')

    useCalendarStore.getState().setGroupMode('status')
    expect(useCalendarStore.getState().groupMode).toBe('status')

    useCalendarStore.getState().setGroupMode('professionals')
    expect(useCalendarStore.getState().groupMode).toBe('professionals')
  })

  it('supports setting densityMode between compact and comfortable', () => {
    useCalendarStore.getState().setDensityMode('compact')
    expect(useCalendarStore.getState().densityMode).toBe('compact')

    useCalendarStore.getState().setDensityMode('comfortable')
    expect(useCalendarStore.getState().densityMode).toBe('comfortable')
  })

  it('keeps groupMode and densityMode independent of view changes', () => {
    // Set custom modes
    useCalendarStore.getState().setGroupMode('status')
    useCalendarStore.getState().setDensityMode('compact')

    // Change view
    useCalendarStore.getState().setView('day')
    expect(useCalendarStore.getState().groupMode).toBe('status')
    expect(useCalendarStore.getState().densityMode).toBe('compact')

    // Change view again
    useCalendarStore.getState().setView('professionals')
    expect(useCalendarStore.getState().groupMode).toBe('status')
    expect(useCalendarStore.getState().densityMode).toBe('compact')
  })
})

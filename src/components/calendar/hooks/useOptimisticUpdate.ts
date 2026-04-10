// src/components/calendar/hooks/useOptimisticUpdate.ts
'use client'

import { useCallback } from 'react'

interface RescheduleParams {
  appointmentId: string
  newDate: string
  newTime: string
  notifyPatient?: boolean
}

interface ResizeParams {
  appointmentId: string
  durationMinutes: number
}

export function useOptimisticUpdate(invalidateCalendar: () => void) {
  const reschedule = useCallback(async (params: RescheduleParams): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/appointments/${params.appointmentId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_date: params.newDate,
          new_time: params.newTime,
          notify_patient: params.notifyPatient ?? true,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data.error || 'Erro ao reagendar' }
      }
      invalidateCalendar()
      return { success: true }
    } catch {
      return { success: false, error: 'Sem conexão com o servidor' }
    }
  }, [invalidateCalendar])

  const resize = useCallback(async (params: ResizeParams): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/appointments/${params.appointmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_minutes: params.durationMinutes }),
      })
      if (!res.ok) {
        return { success: false, error: 'Erro ao alterar duração' }
      }
      invalidateCalendar()
      return { success: true }
    } catch {
      return { success: false, error: 'Sem conexão com o servidor' }
    }
  }, [invalidateCalendar])

  return { reschedule, resize }
}

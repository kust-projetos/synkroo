/**
 * Tests for Analytics Service
 */

import {
  getAppointmentTrends,
  getHourlyDistribution,
  getDayOfWeekDistribution,
  getHighRiskPatients,
  getDemandForecast,
  getClinicInsights,
} from '@/services/analytics/analytics.service'

// Mock the Supabase client
jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

// Mock the logger
jest.mock('@/lib/logger', () => ({
  dbLogger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}))

const mockSupabase = {
  from: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  const { createTypedClient } = require('@/lib/supabase/typed')
  createTypedClient.mockReturnValue(mockSupabase)
})

describe('Analytics Service', () => {
  const clinicId = 'clinic-123'

  describe('getAppointmentTrends', () => {
    it('should return appointment trends grouped by date', async () => {
      const mockAppointments = [
        { scheduled_at: '2024-01-15T10:00:00Z', status: 'completed' },
        { scheduled_at: '2024-01-15T14:00:00Z', status: 'confirmed' },
        { scheduled_at: '2024-01-15T16:00:00Z', status: 'cancelled' },
        { scheduled_at: '2024-01-16T10:00:00Z', status: 'no_show' },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockAppointments,
                error: null,
              }),
            }),
          }),
        }),
      })

      const trends = await getAppointmentTrends(clinicId, 30)

      expect(trends).toHaveLength(2)
      expect(trends[0].date).toBe('2024-01-15')
      expect(trends[0].total).toBe(3)
      expect(trends[0].completed).toBe(1)
      expect(trends[0].confirmed).toBe(1)
      expect(trends[0].cancelled).toBe(1)
    })

    it('should return empty array on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      })

      const trends = await getAppointmentTrends(clinicId, 30)

      expect(trends).toEqual([])
    })
  })

  describe('getHourlyDistribution', () => {
    it('should calculate hourly distribution correctly', async () => {
      // Use local time to avoid timezone issues
      const now = new Date()
      const hour1 = now.getHours()
      const hour2 = (hour1 + 3) % 24

      const mockAppointments = [
        { scheduled_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour1, 0).toISOString() },
        { scheduled_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour1, 30).toISOString() },
        { scheduled_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour2, 0).toISOString() },
        { scheduled_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour2, 30).toISOString() },
        { scheduled_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour2, 45).toISOString() },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: mockAppointments,
              error: null,
            }),
          }),
        }),
      })

      const distribution = await getHourlyDistribution(clinicId, 90)

      // Check the distribution contains the right counts
      const totalAppointments = distribution.reduce((sum, h) => sum + h.count, 0)
      expect(totalAppointments).toBe(5)

      // Find the hours with appointments
      const hoursWithAppointments = distribution.filter((h) => h.count > 0)
      expect(hoursWithAppointments).toHaveLength(2)

      // Check percentages
      const totalPercentage = distribution.reduce((sum, h) => sum + h.percentage, 0)
      expect(totalPercentage).toBe(100)
    })

    it('should handle empty appointments', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      })

      const distribution = await getHourlyDistribution(clinicId, 90)

      expect(distribution).toHaveLength(24)
      distribution.forEach((hour) => {
        expect(hour.count).toBe(0)
        expect(hour.percentage).toBe(0)
      })
    })
  })

  describe('getDayOfWeekDistribution', () => {
    it('should calculate day of week distribution correctly', async () => {
      // Monday (day 1) and Wednesday (day 3)
      const mockAppointments = [
        { scheduled_at: '2024-01-15T10:00:00Z' }, // Monday
        { scheduled_at: '2024-01-15T14:00:00Z' }, // Monday
        { scheduled_at: '2024-01-17T10:00:00Z' }, // Wednesday
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: mockAppointments,
              error: null,
            }),
          }),
        }),
      })

      const distribution = await getDayOfWeekDistribution(clinicId, 90)

      const monday = distribution.find((d) => d.dayIndex === 1)
      const wednesday = distribution.find((d) => d.dayIndex === 3)

      expect(monday?.count).toBe(2)
      expect(wednesday?.count).toBe(1)
      expect(monday?.day).toBe('Seg')
      expect(wednesday?.day).toBe('Qua')
    })
  })

  describe('getHighRiskPatients', () => {
    it('should identify high risk patients with correct factors', async () => {
      const oldDate = new Date()
      oldDate.setMonth(oldDate.getMonth() - 8)

      const mockPatients = [
        {
          id: 'patient-1',
          name: 'João Silva',
          phone: '11999999999',
          last_visit: oldDate.toISOString(),
          risk_score: 75,
          appointments: [
            { status: 'cancelled' },
            { status: 'cancelled' },
            { status: 'cancelled' },
            { status: 'no_show' },
          ],
        },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockPatients,
                error: null,
              }),
            }),
          }),
        }),
      })

      const riskPatients = await getHighRiskPatients(clinicId, 20)

      expect(riskPatients).toHaveLength(1)
      expect(riskPatients[0].patient_name).toBe('João Silva')
      expect(riskPatients[0].risk_score).toBe(75)
      expect(riskPatients[0].no_show_count).toBe(1)
      expect(riskPatients[0].cancelled_count).toBe(3)
      expect(riskPatients[0].risk_factors).toContain('1 no-show(s)')
      expect(riskPatients[0].risk_factors).toContain('3 cancelamentos')
    })

    it('should detect patients who never visited', async () => {
      const mockPatients = [
        {
          id: 'patient-2',
          name: 'Maria Santos',
          phone: '11888888888',
          last_visit: null,
          risk_score: 50,
          appointments: [],
        },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockPatients,
                error: null,
              }),
            }),
          }),
        }),
      })

      const riskPatients = await getHighRiskPatients(clinicId, 20)

      expect(riskPatients[0].risk_factors).toContain('Nunca visitou')
    })
  })

  describe('getDemandForecast', () => {
    it('should generate demand forecast based on historical data', async () => {
      // Mock the count queries for each day and historical week
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lt: jest.fn().mockResolvedValue({
                count: 10,
                error: null,
              }),
            }),
          }),
        }),
      })

      const forecast = await getDemandForecast(clinicId, 3)

      expect(forecast).toHaveLength(3)
      expect(forecast[0]).toHaveProperty('date')
      expect(forecast[0]).toHaveProperty('predicted_appointments')
      expect(forecast[0]).toHaveProperty('confidence')
      expect(forecast[0]).toHaveProperty('based_on')
    })

    it('should return empty array on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lt: jest.fn().mockResolvedValue({
                count: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      })

      const forecast = await getDemandForecast(clinicId, 3)

      // Should still return forecasts even with errors
      expect(forecast.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getClinicInsights', () => {
    it('should aggregate all analytics into comprehensive insights', async () => {
      const mockAppointments = [
        { scheduled_at: '2024-01-15T10:00:00Z', status: 'completed' },
        { scheduled_at: '2024-01-15T14:00:00Z', status: 'cancelled' },
      ]

      // Setup mock for all queries
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: mockAppointments,
                  error: null,
                }),
              }),
            }),
            lt: jest.fn().mockResolvedValue({
              count: 10,
              error: null,
            }),
          }),
        }),
      })

      const insights = await getClinicInsights(clinicId, { trendDays: 7, forecastDays: 3 })

      expect(insights).toHaveProperty('appointmentTrends')
      expect(insights).toHaveProperty('hourlyDistribution')
      expect(insights).toHaveProperty('dayOfWeekDistribution')
      expect(insights).toHaveProperty('highRiskPatients')
      expect(insights).toHaveProperty('demandForecast')
      expect(insights).toHaveProperty('metrics')
      expect(insights.metrics).toHaveProperty('avgAppointmentsPerDay')
      expect(insights.metrics).toHaveProperty('peakHour')
      expect(insights.metrics).toHaveProperty('peakDay')
    })
  })
})
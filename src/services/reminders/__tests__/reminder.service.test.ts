import {
  formatReminderMessage,
  DEFAULT_REMINDER_CONFIGS,
  AppointmentReminder,
} from '../reminder.service'

describe('ReminderService', () => {
  const mockReminder: AppointmentReminder = {
    appointmentId: 'apt-123',
    patientId: 'pat-456',
    patientName: 'João Silva',
    patientPhone: '11999999999',
    scheduledAt: new Date('2026-03-29T14:00:00'),
    dentistName: 'Dra. Maria',
    procedureName: 'Limpeza',
    clinicId: 'clinic-123',
    clinicName: 'Clínica Sorriso',
    clinicPhone: '1133333333',
  }

  describe('DEFAULT_REMINDER_CONFIGS', () => {
    it('should have 24h and 2h reminder configs', () => {
      expect(DEFAULT_REMINDER_CONFIGS).toHaveLength(2)
      expect(DEFAULT_REMINDER_CONFIGS[0].hoursBefore).toBe(24)
      expect(DEFAULT_REMINDER_CONFIGS[1].hoursBefore).toBe(2)
    })

    it('should use WhatsApp as default channel', () => {
      DEFAULT_REMINDER_CONFIGS.forEach(config => {
        expect(config.channels).toContain('whatsapp')
      })
    })
  })

  describe('formatReminderMessage', () => {
    it('should format 24h reminder correctly', () => {
      const message = formatReminderMessage(mockReminder, 24)

      expect(message).toContain('🏥')
      expect(message).toContain('Lembrete de Consulta')
      expect(message).toContain('João Silva')
      expect(message).toContain('Dra. Maria')
      expect(message).toContain('Limpeza')
      expect(message).toContain('Clínica Sorriso')
      expect(message).toContain('amanhã')
    })

    it('should format 2h reminder correctly', () => {
      const message = formatReminderMessage(mockReminder, 2)

      expect(message).toContain('2 horas')
      expect(message).toContain('João Silva')
      expect(message).toContain('Dra. Maria')
      expect(message).toContain('Clínica Sorriso')
    })

    it('should handle missing dentist name', () => {
      const reminderNoDentist = { ...mockReminder, dentistName: undefined }
      const message = formatReminderMessage(reminderNoDentist, 24)

      expect(message).toContain('João Silva')
      expect(message).not.toContain('Profissional')
    })

    it('should handle missing procedure name', () => {
      const reminderNoProcedure = { ...mockReminder, procedureName: undefined }
      const message = formatReminderMessage(reminderNoProcedure, 24)

      expect(message).toContain('João Silva')
      expect(message).not.toContain('Procedimento')
    })

    it('should format date in Brazilian Portuguese', () => {
      const message = formatReminderMessage(mockReminder, 24)

      // Should contain Portuguese day names
      const portugueseDays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
      const hasPortugueseDay = portugueseDays.some(day =>
        message.toLowerCase().includes(day)
      )
      expect(hasPortugueseDay).toBe(true)
    })

    it('should include clinic phone for contact', () => {
      const message24h = formatReminderMessage(mockReminder, 24)
      const message2h = formatReminderMessage(mockReminder, 2)

      expect(message24h).toContain('1133333333')
      expect(message2h).toContain('1133333333')
    })

    it('should handle custom hours before', () => {
      const message = formatReminderMessage(mockReminder, 48)

      expect(message).toContain('João Silva')
      expect(message).toContain('14:00')
    })
  })

  describe('AppointmentReminder interface', () => {
    it('should have all required fields', () => {
      const reminder: AppointmentReminder = {
        appointmentId: 'test-id',
        patientId: 'patient-id',
        patientName: 'Test Patient',
        patientPhone: '11999999999',
        scheduledAt: new Date(),
        clinicId: 'clinic-123',
        clinicName: 'Test Clinic',
        clinicPhone: '1133333333',
      }

      expect(reminder.appointmentId).toBe('test-id')
      expect(reminder.patientName).toBe('Test Patient')
    })
  })
})
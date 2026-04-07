/**
 * Message sending validation
 */
import { z } from 'zod'

export const sendMessageSchema = z.object({
  to: z.string().regex(/^\+?\d{10,15}$/, 'Invalid phone number'),
  message: z.string().min(1).max(4096),
  channel: z.enum(['whatsapp', 'instagram', 'web']).optional(),
})

export const whatsappSendSchema = sendMessageSchema

export const clinicSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  settings: z.record(z.unknown()).optional(),
})

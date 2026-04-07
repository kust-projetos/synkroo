/**
 * Campaign validation schemas
 */
import { z } from 'zod'

export const createCampaignSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  campaign_type: z.enum(['reactivation', 'retention', 'promotional', 'follow_up']),
  target_segment: z.string().max(100).optional(),
  message_template: z.string().min(1).max(2000),
  channel: z.enum(['whatsapp', 'instagram', 'web']).optional(),
  scheduled_at: z.string().datetime().optional(),
  auto_start: z.boolean().optional(),
})

export const updateCampaignSchema = z.object({
  status: z.enum(['paused', 'running', 'cancelled', 'draft']).optional(),
})

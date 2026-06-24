/**
 * Follow-up e Retenção — schema bridge.
 *
 * No new tables — follow-up operates on existing tables from other modules:
 * - campaigns, campaignRecipients from src/lib/db/schema/crm.ts
 * - patientFeedback from src/modules/operacional/schema/patients.ts
 *
 * Import via @/modules/followup/schema.
 */

export { campaigns, campaignRecipients } from '@/lib/db/schema/crm';
export { patientFeedback } from '@/lib/db/schema';

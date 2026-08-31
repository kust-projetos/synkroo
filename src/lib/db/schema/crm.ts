/**
 * Deprecated compatibility re-exports.
 * New code imports schemas from their owning bounded context.
 */
export { leads, leadActivities } from '@/modules/comercial/schema/leads';
export { pipelineStages } from '@/modules/comercial/schema/pipeline';
export { tasks } from '@/modules/comercial/schema/tasks';
export {
  campaigns,
  campaignRecipients,
  followUps,
  followUpConfigs,
  campaignSegments,
} from '@/modules/followup/schema/campaigns';
export { clinicTags, consents, customFieldDefinitions, customFieldValues } from '@/modules/crm/schema/contacts';

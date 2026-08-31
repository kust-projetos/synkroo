/** @deprecated Use the Follow-up module's public outbox consumer. */
export {
  dispatchCampaignRecipientJob,
  dispatchNextCampaignRecipient,
  markCampaignRecipientDeadLetter,
} from '@/modules/followup/services/dispatch-campaign-recipient';

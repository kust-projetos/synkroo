/**
 * Deprecated compatibility re-exports.
 * Infrastructure tables now live in Core or their owning module.
 */
export { idempotencyKeys, outboxJobs, auditLogs } from '@/core/schema/infra';
export { knowledgeBase } from '@/modules/ia/schema/knowledge';
export { whatsappInstances, channelInstallations, messageTemplates } from '@/modules/atendimento/schema/integrations';
export { consents, customFieldDefinitions, customFieldValues } from '@/modules/crm/schema/contacts';

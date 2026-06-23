/**
 * DEPRECATED — backward-compat re-export.
 *
 * Conversations/messages schema moved to src/modules/atendimento/schema/.
 * Keep this file so existing imports via @/lib/db/schema continue to work.
 * New code should import from @/modules/atendimento/schema.
 */
export * from '../../../modules/atendimento/schema/conversations';

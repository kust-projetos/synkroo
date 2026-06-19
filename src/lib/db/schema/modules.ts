import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';

// Contratação no nível instância (DB dedicado por cliente). moduleId PK = singleton por instância (§4.1).
export const instanceModules = pgTable('instance_modules', {
  moduleId: text('module_id').primaryKey(),
  enabled: boolean('enabled').default(false).notNull(),
  contractedAt: timestamp('contracted_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

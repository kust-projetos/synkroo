/**
 * Schema RBAC — ownership movido para src/modules/core/schema/
 * para co-localizar com o módulo core.
 */
import { pgTable, uuid, text, boolean, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { clinics, users } from '@/lib/db/schema/core';

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionKey: text('permission_key').notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.roleId, t.permissionKey] }) }));

export const userClinicAccess = pgTable('user_clinic_access', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.clinicId] }) }));

export const userPermissionOverrides = pgTable('user_permission_overrides', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  permissionKey: text('permission_key').notNull(),
  granted: boolean('granted').notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.clinicId, t.permissionKey] }) }));

export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  module: text('module').notNull(),
  label: text('label').notNull(),
});

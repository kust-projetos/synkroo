/**
 * Operacional module — repository exports barrel.
 * Only exports non-conflicting symbols. Explicit re-exports for
 * names that collide across repositories (e.g., findById).
 */
export * from './patients-repository';
export * from './catalog-repository';
export * from './reminders-repository';
export * from './waitlist-repository';

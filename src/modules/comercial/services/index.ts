/**
 * Comercial services — public service surface.
 *
 * Re-exports services that other modules need, avoiding the circular
 * dependency caused by the module root index.ts (which imports actions
 * that import back into calling modules at module-init time).
 */
export { isLeadMerged } from './merge-state-service';

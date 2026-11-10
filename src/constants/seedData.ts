import type { UserNotification } from '../types';

export { INITIAL_TEACHERS, INITIAL_PRODUCTS } from './ecmcOrcidData';

// Remove only these old ECMC fixtures during the one-time local migration.
// User-created records and the six other schools are not demo fixtures here.
export const LEGACY_ECMC_PRODUCT_IDS: ReadonlySet<string> = new Set(
  Array.from({ length: 15 }, (_, index) => `prod-${String(index + 1).padStart(3, '0')}`)
);
export const LEGACY_ECMC_TEACHER_IDS: ReadonlySet<string> = new Set(
  Array.from({ length: 6 }, (_, index) => `doc-${String(index + 1).padStart(3, '0')}`)
);

export const INITIAL_NOTIFICATIONS: UserNotification[] = [];

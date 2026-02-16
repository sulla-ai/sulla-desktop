// Import all pg tool registrations
import { pgCountRegistration } from './pg_count';
import { pgExecuteRegistration } from './pg_execute';
import { pgQueryRegistration } from './pg_query';
import { pgQueryAllRegistration } from './pg_queryall';
import { pgQueryOneRegistration } from './pg_queryone';
import { pgTransactionRegistration } from './pg_transaction';

// Export all pg tool registrations as an array
export const pgToolRegistrations = [
  pgCountRegistration,
  pgExecuteRegistration,
  pgQueryRegistration,
  pgQueryAllRegistration,
  pgQueryOneRegistration,
  pgTransactionRegistration,
];

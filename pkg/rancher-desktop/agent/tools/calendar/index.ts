// Import all calendar tool registrations
import { calendarCancelRegistration } from './calendar_cancel';
import { calendarCreateRegistration } from './calendar_create';
import { calendarDeleteRegistration } from './calendar_delete';
import { calendarGetRegistration } from './calendar_get';
import { calendarListUpcomingRegistration } from './calendar_list_upcoming';
import { calendarListRegistration } from './calendar_list';
import { calendarUpdateRegistration } from './calendar_update';

// Export all calendar tool registrations as an array
export const calendarToolRegistrations = [
  calendarCancelRegistration,
  calendarCreateRegistration,
  calendarDeleteRegistration,
  calendarGetRegistration,
  calendarListUpcomingRegistration,
  calendarListRegistration,
  calendarUpdateRegistration,
];

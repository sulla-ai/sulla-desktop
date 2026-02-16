// Import all slack tool registrations
import { slackThreadRegistration } from './slack_thread';
import { slackUnreactRegistration } from './slack_unreact';
import { slackUpdateRegistration } from './slack_update';
import { slackUserRegistration } from './slack_user';

// Export all slack tool registrations as an array
export const slackToolRegistrations = [
  slackThreadRegistration,
  slackUnreactRegistration,
  slackUpdateRegistration,
  slackUserRegistration,
];

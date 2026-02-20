// Import all slack tool registrations
import { slackSendMessageRegistration } from './slack_send_message';
import { slackSearchUsersRegistration } from './slack_search_users';
import { slackConnectionHealthRegistration } from './slack_connection_health';
import { slackApiMethodToolRegistrations, slackScopeToolRegistrations } from './slack_scope_commands';
import { slackThreadRegistration } from './slack_thread';
import { slackUnreactRegistration } from './slack_unreact';
import { slackUpdateRegistration } from './slack_update';
import { slackUserRegistration } from './slack_user';

// Export all slack tool registrations as an array
export const slackToolRegistrations = [
  slackConnectionHealthRegistration,
  slackSendMessageRegistration,
  slackSearchUsersRegistration,
  ...slackScopeToolRegistrations,
  ...slackApiMethodToolRegistrations,
  slackThreadRegistration,
  slackUnreactRegistration,
  slackUpdateRegistration,
  slackUserRegistration,
];

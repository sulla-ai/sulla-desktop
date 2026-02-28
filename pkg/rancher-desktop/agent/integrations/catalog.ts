export type { Integration } from './types';
import type { Integration } from './types';
import { nativeIntegrations } from './native';

/** Always-available integrations (Slack, GitHub, Composio, ActivePieces) */
export const integrations: Record<string, Integration> = {
  ...nativeIntegrations,
};

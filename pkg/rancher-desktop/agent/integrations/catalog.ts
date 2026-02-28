export type { Integration } from './types';
import type { Integration } from './types';
import { nativeIntegrations } from './native';

/** Always-available integrations (Slack, GitHub, ActivePieces, AI providers) */
export const integrations: Record<string, Integration> = {
  ...nativeIntegrations,
};

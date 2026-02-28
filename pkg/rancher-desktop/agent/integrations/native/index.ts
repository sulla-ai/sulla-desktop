import type { Integration } from '../types';
import { nativeSlackIntegration } from './communication';
import { nativeGitHubIntegration } from './developer_tools';
import { nativeAiInfrastructureIntegrations } from './ai_infrastructure';

export const nativeIntegrations: Record<string, Integration> = {
  ...nativeSlackIntegration,
  ...nativeGitHubIntegration,
  ...nativeAiInfrastructureIntegrations,
};

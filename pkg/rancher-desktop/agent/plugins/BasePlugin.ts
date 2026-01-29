// BasePlugin - Abstract base class for all plugins

import type { ThreadState, Plugin, PluginConfig } from '../types';

export abstract class BasePlugin implements Plugin {
  config: PluginConfig;

  constructor(config: Partial<PluginConfig> & { id: string; name: string }) {
    this.config = {
      id:       config.id,
      name:     config.name,
      order:    config.order ?? 100,
      enabled:  config.enabled ?? true,
      settings: config.settings ?? {},
    };
  }

  async initialize(): Promise<void> {
    // Override in subclass if needed
  }

  async beforeProcess(state: ThreadState): Promise<ThreadState> {
    // Override in subclass if needed
    return state;
  }

  async process(state: ThreadState): Promise<ThreadState> {
    // Override in subclass if needed
    return state;
  }

  async afterProcess(state: ThreadState): Promise<ThreadState> {
    // Override in subclass if needed
    return state;
  }

  async destroy(): Promise<void> {
    // Override in subclass if needed
  }
}

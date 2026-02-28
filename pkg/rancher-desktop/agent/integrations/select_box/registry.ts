import type { SelectBoxProvider } from './SelectBoxProvider';

const providers = new Map<string, SelectBoxProvider>();

export function registerSelectBoxProvider(provider: SelectBoxProvider): void {
  providers.set(provider.id, provider);
}

export function getSelectBoxProvider(id: string): SelectBoxProvider | undefined {
  return providers.get(id);
}

export function getAllSelectBoxProviders(): Map<string, SelectBoxProvider> {
  return providers;
}

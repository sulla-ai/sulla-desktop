import { SelectBoxProvider, type SelectBoxContext, type SelectOption } from './SelectBoxProvider';

export class KimiModels extends SelectBoxProvider {
  readonly id = 'kimi_models';

  async getOptions(_context: SelectBoxContext): Promise<SelectOption[]> {
    return [
      { value: 'moonshot-v1-128k', label: 'Moonshot v1 128K', description: '128K context window' },
      { value: 'moonshot-v1-32k', label: 'Moonshot v1 32K', description: '32K context window' },
      { value: 'moonshot-v1-8k', label: 'Moonshot v1 8K', description: '8K context window' },
    ];
  }
}

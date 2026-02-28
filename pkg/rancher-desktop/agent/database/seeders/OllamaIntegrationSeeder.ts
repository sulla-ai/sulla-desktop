import { IntegrationValueModel } from '../models/IntegrationValueModel';

const INTEGRATION_ID = 'ollama';
const ACCOUNT_ID = 'sulla_local_ollama';

const DEFAULTS = {
  label: 'Sulla Local Ollama',
  baseUrl: 'http://127.0.0.1:30114',
  model: 'qwen2:0.5b',
  embedTextModel: 'nomic-embed-text',
};

async function initialize(): Promise<void> {
  console.log('[OllamaIntegrationSeeder] Starting...');

  await IntegrationValueModel.upsert(INTEGRATION_ID, ACCOUNT_ID, 'account_label', DEFAULTS.label);
  await IntegrationValueModel.upsert(INTEGRATION_ID, ACCOUNT_ID, 'base_url', DEFAULTS.baseUrl);
  await IntegrationValueModel.upsert(INTEGRATION_ID, ACCOUNT_ID, 'model', DEFAULTS.model);
  await IntegrationValueModel.upsert(INTEGRATION_ID, ACCOUNT_ID, 'embed_text_model', DEFAULTS.embedTextModel);
  await IntegrationValueModel.upsert(INTEGRATION_ID, ACCOUNT_ID, 'connection_status', 'true');

  // Mark this account as the default account for Ollama.
  await IntegrationValueModel.setDefaultAccount(INTEGRATION_ID, ACCOUNT_ID);

  console.log('[OllamaIntegrationSeeder] Seeded default Ollama integration values');
}

export { initialize };

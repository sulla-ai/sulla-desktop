// N8nUserSeeder.ts
// Seeds the n8n database with a user and API key for Sulla integration

import { N8nUserModel } from '../models/N8nUserModel';
import { N8nUserApiKeyModel } from '../models/N8nUserApiKeyModel';

async function initialize(): Promise<void> {
  console.log('[N8nUserSeeder] Starting...');

  console.log(`[N8nUserSeeder] Get or creating user:`);

  // Create the user with plain password - the model will hash it
  const user = await N8nUserModel.getOrCreateServiceAccount();
  const apiKeyModel = await N8nUserApiKeyModel.getOrCreateServiceAccount(user.attributes.id);
  
  console.log(`[N8nUserSeeder] Created N8N User with ID: ${user.attributes.id}`);
  console.log(`[N8nUserSeeder] Created N8N API key with ID: ${apiKeyModel.attributes.id}`);

}

export { initialize };

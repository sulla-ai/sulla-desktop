import { BaseModel } from '../BaseModel';
import { SullaSettingsModel } from './SullaSettingsModel';
import * as crypto from 'crypto';

/**
 * Maps integration slugs to their corresponding n8n credential type identifiers.
 * Falls back to `${slug}Api` for unmapped integrations.
 */
const N8N_CREDENTIAL_TYPE_MAP: Record<string, string> = {
  slack:     'slackApi',
  github:    'githubApi',
  gmail:     'gmailOAuth2Api',
  discord:   'discordApi',
  telegram:  'telegramApi',
  openai:    'openAiApi',
  anthropic: 'anthropicApi',
  grok:      'grokApi',
};

export class N8nCredentialsEntityModel extends BaseModel {
  protected readonly tableName = 'credentials_entity';

  protected readonly fillable = [
    'id',
    'name',
    'data',
    'type',
    'isManaged',
    'isGlobal',
    'isResolvable',
    'resolvableAllowFallback',
    'resolverId',
  ];

  // n8n credentials_entity uses camelCase timestamps (createdAt/updatedAt),
  // not snake_case created_at/updated_at expected by BaseModel timestamps.
  protected readonly timestamps = false;

  async save(): Promise<this> {
    if (!this.attributes.id) {
      this.attributes.id = SullaSettingsModel.generateId();
    }
    return super.save();
  }

  /**
   * Encrypt a credential data object using n8n's AES-256-GCM encryption
   * and set it on the `data` attribute.
   * @param credential - Plain object of credential key/value pairs
   */
  async encryptData(credential: Record<string, any>): Promise<void> {
    const encryptionKey = await SullaSettingsModel.get('sullaN8nEncryptionKey');
    if (!encryptionKey) {
      throw new Error('No encryption key found in settings');
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

    const plaintext = JSON.stringify(credential);
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    this.attributes.data = JSON.stringify({
      encryptedData: encrypted.toString('base64'),
      iv:            iv.toString('base64'),
      tag:           tag.toString('base64'),
    });
  }

  /**
   * Transfer credentials from IntegrationService into n8n's credentials_entity table.
   * Looks up the integration by slug, reads form values from the active account,
   * encrypts them, and upserts the corresponding credentials_entity row.
   *
   * @param integrationSlug - The integration id (e.g. 'slack', 'github')
   * @returns The saved N8nCredentialsEntityModel instance
   */
  static async transferCredentials(integrationSlug: string): Promise<N8nCredentialsEntityModel> {
    const { getIntegrationService } = await import('../../services/IntegrationService');
    const { integrations } = await import('../../integrations/catalog');

    const service = getIntegrationService();
    await service.initialize();

    const catalogEntry = integrations[integrationSlug];
    if (!catalogEntry) {
      throw new Error(`Integration "${integrationSlug}" not found in catalog`);
    }

    // Build credential data from integration form values
    const formValues = await service.getFormValues(integrationSlug);
    const credentialData: Record<string, string> = {};
    for (const fv of formValues) {
      credentialData[fv.property] = fv.value;
    }

    if (Object.keys(credentialData).length === 0) {
      throw new Error(`No credentials found for integration "${integrationSlug}"`);
    }

    // n8n credential type mapping
    const n8nType = N8N_CREDENTIAL_TYPE_MAP[integrationSlug] || `${integrationSlug}Api`;

    // Find existing credential by type or create new
    const existing = await N8nCredentialsEntityModel.where<N8nCredentialsEntityModel>('type', n8nType);
    let model: N8nCredentialsEntityModel;

    if (existing.length > 0) {
      model = existing[0];
    } else {
      model = new N8nCredentialsEntityModel();
      model.fill({
        name: catalogEntry.name,
        type: n8nType,
      });
    }

    await model.encryptData(credentialData);
    await model.save();

    console.log(`[N8nCredentialsEntityModel] Transferred credentials for ${integrationSlug} → ${n8nType} (id: ${model.attributes.id})`);
    return model;
  }

  /**
   * Decrypt the credential data using n8n's AES-256-GCM encryption
   * @returns Decrypted credential data object
   */
  async decryptData(): Promise<any> {
    const encryptedData = this.attributes.data;
    if (!encryptedData) {
      throw new Error('No encrypted data found');
    }

    const encryptionKey = await SullaSettingsModel.get('sullaN8nEncryptionKey');
    if (!encryptionKey) {
      throw new Error('No encryption key found in settings');
    }

    // Parse the encrypted data (assuming it's stored as JSON)
    let parsedData;
    try {
      parsedData = JSON.parse(encryptedData);
    } catch (error) {
      // If it's not JSON, assume it's directly encrypted data
      parsedData = encryptedData;
    }

    // Handle different possible formats
    if (typeof parsedData === 'object' && parsedData.encryptedData) {
      // Format: { encryptedData: base64, iv: base64, tag: base64 }
      const encrypted = Buffer.from(parsedData.encryptedData, 'base64');
      const iv = Buffer.from(parsedData.iv, 'base64');
      const tag = Buffer.from(parsedData.tag, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return JSON.parse(decrypted.toString());
    } else if (typeof parsedData === 'string') {
      // Assume base64 encoded encrypted data with embedded IV and tag
      // This is a simplified approach - n8n might use a different format
      const encrypted = Buffer.from(parsedData, 'base64');
      
      // Extract IV (first 12 bytes) and tag (last 16 bytes)
      const iv = encrypted.subarray(0, 12);
      const tag = encrypted.subarray(-16);
      const encryptedPayload = encrypted.subarray(12, -16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedPayload);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return JSON.parse(decrypted.toString());
    } else {
      throw new Error('Unsupported encrypted data format');
    }
  }
}

import { BaseModel } from '../BaseModel';
import { SullaSettingsModel } from './SullaSettingsModel';
import * as crypto from 'crypto';

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

  protected readonly timestamps = true;

  async save(): Promise<this> {
    if (!this.attributes.id) {
      this.attributes.id = SullaSettingsModel.generateId();
    }
    return super.save();
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

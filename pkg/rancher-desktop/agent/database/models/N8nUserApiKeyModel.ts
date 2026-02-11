// src/models/UserApiKey.ts

import { BaseModel } from '../BaseModel';
import * as crypto from 'crypto';
import { N8nUserModel } from '../models/N8nUserModel';
import { SullaSettingsModel } from './SullaSettingsModel';

interface UserApiKeyAttributes {
  id: string;
  userId: string;
  label: string;
  apiKey: string;
  createdAt: Date;
  updatedAt: Date;
  scopes: string[];
  audience: string;
}

export class N8nUserApiKeyModel extends BaseModel<UserApiKeyAttributes> {
  protected readonly tableName = 'user_api_keys';
  protected readonly primaryKey = 'id';
  protected readonly timestamps = false;

  protected readonly fillable = [
    'id',
    'userId',
    'label',
    'apiKey',
    'scopes',
    'audience',
  ];

  /**
   * Define casting rules for automatic type conversion
   */
  protected readonly casts: Record<string, string> = {
    scopes: 'json',  // scopes field should be cast as json
  };

  public getApiKey(): string {
    return this.attributes.apiKey!;
  }

  /**
   * Generate a UUID in the format n8n expects (similar to their format)
   */
  public static createNewApiKeyId(): string {
    const apiKeyId = crypto.randomBytes(12).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    return apiKeyId;
  }

  /**
   * Generate JWT token for API key (simplified version)
   */
  public static async createNewApiKeyToken(userId:string): Promise<string> {
    
    const jwtPayload = {
      sub: userId,
      iss: 'n8n',
      aud: 'public-api',
      jti: crypto.randomBytes(16).toString('hex'),
      iat: Math.floor(Date.now() / 1000),
    };

    // Use a simple secret for JWT (in production this should be configurable)
    const jwtSecret = 'sulla-integration-secret';
    const jwt = await import('jsonwebtoken');
    const apiKeyToken = jwt.default.sign(jwtPayload, jwtSecret);
    return apiKeyToken;
  }

  /**
   * 
   * @returns 
   */
  public static async getOrCreateServiceAccount(userId: string | undefined): Promise<N8nUserApiKeyModel> {
    let _userId;
    if (userId) {
      _userId = userId;
    } else {
      const user = await N8nUserModel.getOrCreateServiceAccount();
      _userId = user.attributes.id;
    }

    // @ts-ignore
    const apiKeyToken = await N8nUserApiKeyModel.createNewApiKeyToken(_userId);
    const apiKeyId = SullaSettingsModel.generateId();
    
    const apiKey = await N8nUserApiKeyModel.create({
      id: apiKeyId,
      userId: _userId,
      label: 'Sulla Integration',
      apiKey: apiKeyToken,
      scopes: [
        "credential:move",
        "credential:create",
        "credential:update",
        "credential:delete",
        "project:create",
        "project:update",
        "project:delete",
        "project:list",
        "securityAudit:generate",
        "sourceControl:pull",
        "tag:create",
        "tag:read",
        "tag:update",
        "tag:delete",
        "tag:list",
        "user:changeRole",
        "user:enforceMfa",
        "user:create",
        "user:read",
        "user:delete",
        "user:list",
        "workflow:execute",
        "workflow:read",
        "workflow:create",
        "workflow:update",
        "workflow:delete",
        "workflow:list",
        "workflow:share",
        "workflow:share:read",
        "workflow:share:create",
        "workflow:share:update",
        "workflow:share:delete",
        "workflow:share:list",
        "workflow:share:read",
        "workflow:share:create",
        "workflow:share:update",
        "workflow:share:delete",
        "workflow:share:list",
      ],
      audience: 'public-api',
    });
    
    return apiKey;
  }

  async save(): Promise<this> {
    if (!this.attributes.id) {
      this.attributes.id = SullaSettingsModel.generateId();
    }
    return this;
  }
}

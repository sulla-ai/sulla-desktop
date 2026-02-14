import { BaseTool } from "../base";
import { z } from "zod";
import { google } from 'googleapis';
import { getIntegrationService } from '../../services/IntegrationService';

export class GmailGetMessageTool extends BaseTool {
  name = "gmail_get_message";
  description = "Get a specific email message from Gmail.";
  schema = z.object({
    messageId: z.string().describe("The ID of the message to retrieve"),
  });

  metadata = { category: "communication" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { messageId } = input;

    // Get Google credentials from IntegrationService
    const integrationService = getIntegrationService();
    const clientId = await integrationService.getIntegrationValue('gmail', 'client_id');
    const clientSecret = await integrationService.getIntegrationValue('gmail', 'client_secret');
    const redirectUri = await integrationService.getIntegrationValue('gmail', 'redirect_uri');

    if (clientId) process.env.GOOGLE_CLIENT_ID = clientId.value;
    if (clientSecret) process.env.GOOGLE_CLIENT_SECRET = clientSecret.value;
    if (redirectUri) process.env.GOOGLE_REDIRECT_URI = redirectUri.value;

    // Note: Requires Google API credentials to be set up
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    });

    const gmail = google.gmail({ version: 'v1', auth });

    try {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;

      // Parse headers
      const headers = message.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const to = headers.find(h => h.name === 'To')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      // Get body
      let body = '';
      if (message.payload?.parts) {
        const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      } else if (message.payload?.body?.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      }

      return {
        id: message.id,
        threadId: message.threadId,
        labelIds: message.labelIds,
        snippet: message.snippet,
        subject,
        from,
        to,
        date,
        body,
        sizeEstimate: message.sizeEstimate,
      };
    } catch (error) {
      return `Error getting message: ${(error as Error).message}`;
    }
  }
}

import { BaseTool } from "../base";
import { z } from "zod";
import { google } from 'googleapis';
import { getIntegrationService } from '../../services/IntegrationService';

export class GmailGetThreadTool extends BaseTool {
  name = "gmail_get_thread";
  description = "Get a specific email thread from Gmail.";
  schema = z.object({
    threadId: z.string().describe("The ID of the thread to retrieve"),
  });

  metadata = { category: "communication" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { threadId } = input;

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
      const response = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });

      const thread = response.data;

      // Process messages in thread
      const messages = thread.messages?.map(msg => {
        const headers = msg.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        return {
          id: msg.id,
          threadId: msg.threadId,
          labelIds: msg.labelIds,
          snippet: msg.snippet,
          subject,
          from,
          to,
          date,
          sizeEstimate: msg.sizeEstimate,
        };
      }) || [];

      return {
        id: thread.id,
        historyId: thread.historyId,
        messages,
      };
    } catch (error) {
      return `Error getting thread: ${(error as Error).message}`;
    }
  }
}

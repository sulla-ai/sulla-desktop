import { BaseTool } from "../base";
import { z } from "zod";
import { google } from 'googleapis';
import { getIntegrationService } from '../../services/IntegrationService';

export class GmailSearchTool extends BaseTool {
  name = "gmail_search";
  description = "Search for emails in Gmail.";
  schema = z.object({
    query: z.string().describe("Search query (e.g., 'from:example@gmail.com subject:hello')"),
    maxResults: z.number().optional().default(10).describe("Maximum number of results to return"),
  });

  metadata = { category: "communication" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { query, maxResults } = input;

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
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      return {
        messages: response.data.messages || [],
        nextPageToken: response.data.nextPageToken,
        resultSizeEstimate: response.data.resultSizeEstimate,
      };
    } catch (error) {
      return `Error searching messages: ${(error as Error).message}`;
    }
  }
}

import { BaseTool } from "../base";
import { z } from "zod";
import { google } from 'googleapis';
import { getIntegrationService } from '../../services/IntegrationService';

export class GmailSendMessageTool extends BaseTool {
  name = "gmail_send_message";
  description = "Send an email via Gmail.";
  schema = z.object({
    to: z.array(z.string()).describe("Recipient email addresses"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body"),
    cc: z.array(z.string()).optional().describe("CC email addresses"),
    bcc: z.array(z.string()).optional().describe("BCC email addresses"),
  });

  metadata = { category: "communication" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { to, subject, body, cc, bcc } = input;

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
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
    });

    const gmail = google.gmail({ version: 'v1', auth });

    try {
      // Create MIME message
      const mimeMessage = this.createMimeMessage(to, subject, body, cc, bcc);
      const encodedMessage = Buffer.from(mimeMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      return {
        id: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds,
      };
    } catch (error) {
      return `Error sending message: ${(error as Error).message}`;
    }
  }

  private createMimeMessage(to: string[], subject: string, body: string, cc?: string[], bcc?: string[]): string {
    const boundary = 'boundary_' + Math.random().toString(36).substr(2, 9);
    const toHeader = to.map(email => `<${email}>`).join(', ');
    const ccHeader = cc ? cc.map(email => `<${email}>`).join(', ') : '';
    const bccHeader = bcc ? bcc.map(email => `<${email}>`).join(', ') : '';

    return `To: ${toHeader}\r\n` +
           `Subject: ${subject}\r\n` +
           (ccHeader ? `Cc: ${ccHeader}\r\n` : '') +
           (bccHeader ? `Bcc: ${bccHeader}\r\n` : '') +
           `Content-Type: multipart/alternative; boundary="${boundary}"\r\n` +
           `\r\n--${boundary}\r\n` +
           `Content-Type: text/plain; charset=UTF-8\r\n` +
           `\r\n${body}\r\n` +
           `\r\n--${boundary}--`;
  }
}

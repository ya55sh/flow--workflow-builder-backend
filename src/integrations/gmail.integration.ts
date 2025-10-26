import { Injectable } from '@nestjs/common';
import axios from 'axios';

/**
 * Interface representing a Gmail email message
 */
export interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  snippet: string;
  body: string;
  timestamp: string;
  labelIds: string[];
}

/**
 * Gmail Integration Service
 *
 * Handles all interactions with the Gmail API including:
 * - Fetching emails with optional query filters
 * - Sending new emails
 * - Replying to existing emails
 * - Managing labels (adding, removing)
 * - Starring/unstarring emails
 * - Marking emails as read/unread
 * - Retrieving user profile and labels
 */
@Injectable()
export class GmailIntegration {
  private readonly baseUrl = 'https://gmail.googleapis.com/gmail/v1';

  /**
   * Fetch recent emails from Gmail using optional query parameters
   * @param accessToken OAuth2 access token for Gmail API
   * @param query Gmail search query (e.g., 'is:unread', 'from:user@example.com')
   * @param maxResults Maximum number of emails to fetch (default: 10)
   * @returns Array of Gmail email objects
   */
  async fetchRecentEmails(
    accessToken: string,
    query?: string,
    maxResults: number = 10,
  ): Promise<GmailEmail[]> {
    try {
      // First, get the list of message IDs matching the query
      const listUrl = `${this.baseUrl}/users/me/messages`;
      const params: any = { maxResults };
      if (query) params.q = query;

      const listResponse = await axios.get(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      });

      if (
        !listResponse.data.messages ||
        listResponse.data.messages.length === 0
      ) {
        return [];
      }

      // Then, fetch full details for each message (limit to 5 for performance)
      const emails: GmailEmail[] = [];
      for (const message of listResponse.data.messages.slice(0, 5)) {
        const email = await this.getEmailDetails(accessToken, message.id);
        if (email) emails.push(email);
      }

      return emails;
    } catch (error: any) {
      console.error(
        'Error fetching Gmail emails:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to fetch emails: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  async getEmailDetails(
    accessToken: string,
    messageId: string,
  ): Promise<GmailEmail | null> {
    try {
      const url = `${this.baseUrl}/users/me/messages/${messageId}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { format: 'full' },
      });

      const message = response.data;
      const headers = message.payload.headers;

      const getHeader = (name: string) => {
        const header = headers.find(
          (h: any) => h.name.toLowerCase() === name.toLowerCase(),
        );
        return header?.value || '';
      };

      // Extract body
      let body = '';
      if (message.payload.body?.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString(
          'utf-8',
        );
      } else if (message.payload.parts) {
        const textPart = message.payload.parts.find(
          (part: any) => part.mimeType === 'text/plain',
        );
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      }

      return {
        id: message.id,
        threadId: message.threadId,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To'),
        snippet: message.snippet || '',
        body: body.substring(0, 500), // Limit body length
        timestamp: new Date(parseInt(message.internalDate)).toISOString(),
        labelIds: message.labelIds || [],
      };
    } catch (error: any) {
      console.error(
        `Error fetching email ${messageId}:`,
        error.response?.data || error.message,
      );
      return null;
    }
  }

  async sendEmail(
    accessToken: string,
    to: string,
    subject: string,
    body: string,
    from?: string,
  ): Promise<any> {
    try {
      // Create RFC 2822 formatted email
      const email = [
        `To: ${to}`,
        from ? `From: ${from}` : '',
        `Subject: ${subject}`,
        '',
        body,
      ]
        .filter(Boolean)
        .join('\r\n');

      console.log('=== Sending Gmail Email ===');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Body:', body);
      console.log('Raw email:', email);
      console.log('===========================');

      // Encode email in base64url format
      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const url = `${this.baseUrl}/users/me/messages/send`;
      const response = await axios.post(
        url,
        { raw: encodedEmail },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        id: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds,
      };
    } catch (error: any) {
      console.error(
        'Error sending Gmail email:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to send email: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  async listLabels(accessToken: string): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/users/me/labels`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return response.data.labels.map((label: any) => ({
        id: label.id,
        name: label.name,
        type: label.type,
        messageListVisibility: label.messageListVisibility,
        labelListVisibility: label.labelListVisibility,
      }));
    } catch (error: any) {
      console.error(
        'Error listing Gmail labels:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to list labels: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  async getProfile(accessToken: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/users/me/profile`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return {
        emailAddress: response.data.emailAddress,
        messagesTotal: response.data.messagesTotal,
        threadsTotal: response.data.threadsTotal,
        historyId: response.data.historyId,
      };
    } catch (error: any) {
      console.error(
        'Error getting Gmail profile:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to get profile: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  async replyToEmail(
    accessToken: string,
    messageId: string,
    threadId: string,
    body: string,
    subject?: string,
  ): Promise<any> {
    try {
      // Get the original message to extract headers
      const originalMessage = await axios.get(
        `${this.baseUrl}/users/me/messages/${messageId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { format: 'full' },
        },
      );

      const headers = originalMessage.data.payload.headers;
      const getHeader = (name: string) => {
        const header = headers.find(
          (h: any) => h.name.toLowerCase() === name.toLowerCase(),
        );
        return header?.value || '';
      };

      const originalFrom = getHeader('From');
      const originalTo = getHeader('To');
      const originalSubject = getHeader('Subject');
      const originalMessageId = getHeader('Message-ID');
      const originalReferences = getHeader('References');

      // Extract email address from "Name <email@example.com>" format
      const extractEmail = (str: string) => {
        const match = str.match(/<(.+?)>/);
        return match ? match[1] : str;
      };

      const replyTo = extractEmail(originalFrom);
      const replySubject =
        subject ||
        (originalSubject.startsWith('Re:')
          ? originalSubject
          : `Re: ${originalSubject}`);

      // Build References header for threading
      const references = originalReferences
        ? `${originalReferences} ${originalMessageId}`
        : originalMessageId;

      // Create RFC 2822 formatted reply email
      const email = [
        `To: ${replyTo}`,
        `Subject: ${replySubject}`,
        `In-Reply-To: ${originalMessageId}`,
        `References: ${references}`,
        '',
        body,
      ].join('\r\n');

      console.log('=== Replying to Gmail Email ===');
      console.log('Original Message ID:', messageId);
      console.log('Thread ID:', threadId);
      console.log('Reply To:', replyTo);
      console.log('Subject:', replySubject);
      console.log('Body:', body);
      console.log('================================');

      // Encode email in base64url format
      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const url = `${this.baseUrl}/users/me/messages/send`;
      const response = await axios.post(
        url,
        {
          raw: encodedEmail,
          threadId: threadId, // This ensures the reply is in the same thread
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('Reply sent successfully');

      return {
        id: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds,
      };
    } catch (error: any) {
      console.error(
        'Error replying to Gmail email:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to reply to email: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  async addLabelToEmail(
    accessToken: string,
    messageId: string,
    labelIds: string[],
  ): Promise<any> {
    try {
      console.log('=== Adding Label to Gmail Email ===');
      console.log('Message ID:', messageId);
      console.log('Label IDs:', labelIds);

      const url = `${this.baseUrl}/users/me/messages/${messageId}/modify`;
      const response = await axios.post(
        url,
        {
          addLabelIds: labelIds,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('Label added successfully');

      return {
        id: response.data.id,
        labelIds: response.data.labelIds,
      };
    } catch (error: any) {
      console.error(
        'Error adding label to Gmail email:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to add label: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  async starEmail(accessToken: string, messageId: string): Promise<any> {
    try {
      console.log('=== Starring Gmail Email ===');
      console.log('Message ID:', messageId);

      // STARRED is a system label in Gmail
      const url = `${this.baseUrl}/users/me/messages/${messageId}/modify`;
      const response = await axios.post(
        url,
        {
          addLabelIds: ['STARRED'],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('Email starred successfully');

      return {
        id: response.data.id,
        labelIds: response.data.labelIds,
        starred: true,
      };
    } catch (error: any) {
      console.error(
        'Error starring Gmail email:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to star email: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  async markAsRead(accessToken: string, messageId: string): Promise<any> {
    try {
      console.log('=== Marking Gmail Email as Read ===');
      console.log('Message ID:', messageId);

      // Remove UNREAD label
      const url = `${this.baseUrl}/users/me/messages/${messageId}/modify`;
      const response = await axios.post(
        url,
        {
          removeLabelIds: ['UNREAD'],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('Email marked as read successfully');

      return {
        id: response.data.id,
        labelIds: response.data.labelIds,
      };
    } catch (error: any) {
      console.error(
        'Error marking Gmail email as read:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to mark as read: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }
}

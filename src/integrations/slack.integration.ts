import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface SlackMessage {
  type: string;
  user: string;
  text: string;
  ts: string;
  channel: string;
  timestamp: string;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  email?: string;
}

@Injectable()
export class SlackIntegration {
  private readonly baseUrl = 'https://slack.com/api';

  async fetchRecentMessages(
    accessToken: string,
    channel: string,
    limit: number = 10,
  ): Promise<SlackMessage[]> {
    try {
      const url = `${this.baseUrl}/conversations.history`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          channel,
          limit,
        },
      });

      if (!response.data.ok) {
        throw new Error(
          response.data.error || 'Failed to fetch Slack messages',
        );
      }

      return response.data.messages.map((msg: any) => ({
        type: msg.type,
        user: msg.user || 'Unknown',
        text: msg.text || '',
        ts: msg.ts,
        channel,
        timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
      }));
    } catch (error: any) {
      console.error(
        'Error fetching Slack messages:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to fetch Slack messages: ${error.response?.data?.error || error.message}`,
      );
    }
  }

  async postMessage(
    accessToken: string,
    channel: string,
    text: string,
  ): Promise<any> {
    try {
      const url = `${this.baseUrl}/chat.postMessage`;
      const response = await axios.post(
        url,
        {
          channel,
          text,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Failed to post Slack message');
      }

      return {
        channel: response.data.channel,
        ts: response.data.ts,
        message: response.data.message,
      };
    } catch (error: any) {
      console.error(
        'Error posting Slack message:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to post Slack message: ${error.response?.data?.error || error.message}`,
      );
    }
  }

  async getUserInfo(
    accessToken: string,
    userId: string,
  ): Promise<SlackUser | null> {
    try {
      const url = `${this.baseUrl}/users.info`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { user: userId },
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Failed to get Slack user info');
      }

      const user = response.data.user;
      return {
        id: user.id,
        name: user.name,
        real_name: user.real_name,
        email: user.profile?.email,
      };
    } catch (error: any) {
      console.error(
        'Error fetching Slack user info:',
        error.response?.data || error.message,
      );
      return null;
    }
  }

  async sendDirectMessage(
    accessToken: string,
    userId: string,
    text: string,
  ): Promise<any> {
    try {
      // Open DM channel with user
      const openUrl = `${this.baseUrl}/conversations.open`;
      const openResponse = await axios.post(
        openUrl,
        { users: userId },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!openResponse.data.ok) {
        throw new Error(openResponse.data.error || 'Failed to open DM channel');
      }

      const channelId = openResponse.data.channel.id;

      // Send message to DM channel
      return await this.postMessage(accessToken, channelId, text);
    } catch (error: any) {
      console.error(
        'Error sending Slack DM:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to send Slack DM: ${error.response?.data?.error || error.message}`,
      );
    }
  }

  async listChannels(accessToken: string): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/conversations.list`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          types: 'public_channel,private_channel',
          exclude_archived: true,
          limit: 100,
        },
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Failed to list channels');
      }

      return response.data.channels.map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        is_private: ch.is_private,
        is_member: ch.is_member,
      }));
    } catch (error: any) {
      console.error(
        'Error listing Slack channels:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to list Slack channels: ${error.response?.data?.error || error.message}`,
      );
    }
  }

  async getWorkspaceInfo(accessToken: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/team.info`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Failed to get workspace info');
      }

      return {
        id: response.data.team.id,
        name: response.data.team.name,
        domain: response.data.team.domain,
      };
    } catch (error: any) {
      console.error(
        'Error getting Slack workspace info:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to get Slack workspace info: ${error.response?.data?.error || error.message}`,
      );
    }
  }

  async getCurrentUser(accessToken: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/auth.test`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Failed to get current user');
      }

      return {
        user_id: response.data.user_id,
        user: response.data.user,
        team_id: response.data.team_id,
        team: response.data.team,
      };
    } catch (error: any) {
      console.error(
        'Error getting current Slack user:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to get current user: ${error.response?.data?.error || error.message}`,
      );
    }
  }

  async listUsers(accessToken: string): Promise<SlackUser[]> {
    try {
      const url = `${this.baseUrl}/users.list`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Failed to list users');
      }

      return response.data.members
        .filter((member: any) => !member.is_bot && !member.deleted)
        .map((member: any) => ({
          id: member.id,
          name: member.name,
          real_name: member.real_name || member.profile?.real_name,
          email: member.profile?.email,
        }));
    } catch (error: any) {
      console.error(
        'Error listing Slack users:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to list Slack users: ${error.response?.data?.error || error.message}`,
      );
    }
  }
}

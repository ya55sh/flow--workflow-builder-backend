// apps.config.ts

export const AppsCatalog = {
  gmail: {
    id: '1',
    displayName: 'Gmail',
    oauthProvider: 'google', // OAuth provider for credentials
    logo: 'http://localhost:2000/logos/gmail.png',
    triggerScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    actionScopes: ['https://www.googleapis.com/auth/gmail.send'],

    triggers: [
      {
        id: 'new_email',
        title: 'New Email Received',
        description: 'Trigger when a new email arrives in your inbox.',
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        api: {
          url: 'https://www.googleapis.com/gmail/v1/users/me/messages',
          method: 'GET',
          pollingInterval: 60, // seconds
        },
      },
      {
        id: 'email_labeled',
        title: 'Email Labeled',
        description: 'Trigger when an email is labeled.',
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        api: {
          url: 'https://www.googleapis.com/gmail/v1/users/me/messages',
          method: 'GET',
          pollingInterval: 30,
        },
      },
      {
        id: 'email_starred',
        title: 'Email Starred',
        description: 'Trigger when an email is starred.',
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        api: {
          url: 'https://www.googleapis.com/gmail/v1/users/me/messages',
          method: 'GET',
          pollingInterval: 30,
        },
      },
      {
        id: 'email_replied',
        title: 'Email Replied To',
        description: 'Trigger when someone replies to an email.',
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        api: {
          url: 'https://www.googleapis.com/gmail/v1/users/me/messages',
          method: 'GET',
          pollingInterval: 30,
        },
      },
    ],
    actions: [
      {
        id: 'send_email',
        title: 'Send Email',
        description: 'Send an email from your account.',
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
        api: {
          url: 'https://www.googleapis.com/gmail/v1/users/me/messages/send',
          method: 'POST',
          bodyTemplate: {
            raw: '{{base64_encoded_message}}',
          },
        },
      },
      {
        id: 'reply_to_email',
        title: 'Reply to Email',
        description: 'Reply to an existing email.',
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
        api: {
          url: 'https://www.googleapis.com/gmail/v1/users/me/messages/send',
          method: 'POST',
          bodyTemplate: {
            raw: '{{base64_encoded_reply}}',
          },
        },
      },
      {
        id: 'add_label_to_email',
        title: 'Add Label to Email',
        description: 'Add a label to an email.',
        scopes: ['https://www.googleapis.com/auth/gmail.modify'],
        api: {
          url: 'https://www.googleapis.com/gmail/v1/users/me/messages/{{message_id}}/modify',
          method: 'POST',
          bodyTemplate: {
            addLabelIds: ['{{label_id}}'],
          },
        },
      },
      {
        id: 'star_email',
        title: 'Star Email',
        description: 'Star an email.',
        scopes: ['https://www.googleapis.com/auth/gmail.modify'],
        api: {
          url: 'https://www.googleapis.com/gmail/v1/users/me/messages/{{message_id}}/modify',
          method: 'POST',
          bodyTemplate: {
            addLabelIds: ['STARRED'],
          },
        },
      },
    ],

    get scopes() {
      return [...this.triggerScopes, ...this.actionScopes];
    },
  },

  slack: {
    id: '2',
    displayName: 'Slack',
    logo: 'http://localhost:2000/logos/slack.png',
    triggerScopes: [
      'channels:read',
      'channels:history',
      'groups:read',
      'im:read',
      'im:history',
      'mpim:read',
      'users:read', // Required for listing users
    ],
    actionScopes: [
      'chat:write',
      'chat:write.public',
      'im:write',
      'users:read', // Required for getUserInfo
    ],

    triggers: [
      {
        id: 'new_channel_message',
        title: 'New message in channel',
        description: 'Trigger when a new message is posted to a channel.',
        scopes: ['channels:read', 'channels:history'],
        api: {
          url: 'https://slack.com/api/conversations.history',
          method: 'GET',
          params: { channel: '{{channel_id}}' },
          pollingInterval: 30,
        },
      },
      {
        id: 'new_reaction',
        title: 'New Reaction Added',
        description: 'Trigger when a reaction is added to a message.',
        scopes: ['reactions:read'],
        api: {
          url: 'https://slack.com/api/reactions.list',
          method: 'GET',
          pollingInterval: 30,
        },
      },
      {
        id: 'user_joined_channel',
        title: 'User Joined Channel',
        description: 'Trigger when a user joins a channel.',
        scopes: ['channels:read'],
        api: {
          url: 'https://slack.com/api/conversations.members',
          method: 'GET',
          params: { channel: '{{channel_id}}' },
          pollingInterval: 60,
        },
      },
      {
        id: 'message_updated',
        title: 'Message Updated',
        description: 'Trigger when a message is updated.',
        scopes: ['channels:read'],
        api: {
          url: 'https://slack.com/api/conversations.history',
          method: 'GET',
          params: { channel: '{{channel_id}}' },
          pollingInterval: 30,
        },
      },
    ],
    actions: [
      {
        id: 'send_channel_message',
        title: 'Send a message to a channel',
        description: 'Post a message to a channel.',
        scopes: ['chat:write', 'chat:write.public'],
        api: {
          url: 'https://slack.com/api/chat.postMessage',
          method: 'POST',
          bodyTemplate: {
            channel: '{{channel_id}}',
            text: '{{message}}',
          },
        },
      },
      {
        id: 'send_dm',
        title: 'Send Direct Message',
        description: 'Send a direct message to a user.',
        scopes: ['chat:write', 'im:write'],
        api: {
          url: 'https://slack.com/api/chat.postMessage',
          method: 'POST',
          bodyTemplate: {
            channel: '{{user_id}}',
            text: '{{message}}',
          },
        },
      },
      {
        id: 'update_message',
        title: 'Update Message',
        description: 'Update an existing message.',
        scopes: ['chat:write'],
        api: {
          url: 'https://slack.com/api/chat.update',
          method: 'POST',
          bodyTemplate: {
            channel: '{{channel_id}}',
            ts: '{{message_ts}}',
            text: '{{new_message}}',
          },
        },
      },
      {
        id: 'add_reaction',
        title: 'Add Reaction',
        description: 'Add a reaction to a message.',
        scopes: ['reactions:write'],
        api: {
          url: 'https://slack.com/api/reactions.add',
          method: 'POST',
          bodyTemplate: {
            channel: '{{channel_id}}',
            timestamp: '{{message_ts}}',
            name: '{{reaction_name}}',
          },
        },
      },
    ],

    get scopes() {
      return [...this.triggerScopes, ...this.actionScopes];
    },
  },

  github: {
    id: '3',
    displayName: 'GitHub',
    logo: 'http://localhost:2000/logos/github-sign.png',
    triggerScopes: ['repo'],
    actionScopes: ['repo'],

    triggers: [
      {
        id: 'new_issue',
        title: 'New Issue Created',
        description: 'Trigger when a new issue is created in a repository.',
        scopes: ['repo'],
        api: {
          url: 'https://api.github.com/repos/{{owner}}/{{repo}}/issues',
          method: 'GET',
          pollingInterval: 60,
        },
      },
      {
        id: 'pull_request_opened',
        title: 'Pull Request Opened',
        description: 'Trigger when a pull request is opened.',
        scopes: ['repo'],
        api: {
          url: 'https://api.github.com/repos/{{owner}}/{{repo}}/pulls',
          method: 'GET',
          pollingInterval: 60,
        },
      },
      {
        id: 'commit_pushed',
        title: 'Commit Pushed',
        description: 'Trigger when a commit is pushed to a repository.',
        scopes: ['repo'],
        api: {
          url: 'https://api.github.com/repos/{{owner}}/{{repo}}/commits',
          method: 'GET',
          pollingInterval: 30,
        },
      },
      {
        id: 'issue_commented',
        title: 'Issue Commented',
        description: 'Trigger when a comment is added to an issue.',
        scopes: ['repo'],
        api: {
          url: 'https://api.github.com/repos/{{owner}}/{{repo}}/issues/comments',
          method: 'GET',
          pollingInterval: 30,
        },
      },
    ],
    actions: [
      {
        id: 'create_issue',
        title: 'Create Issue',
        description: 'Create a new issue in a repository.',
        scopes: ['repo'],
        api: {
          url: 'https://api.github.com/repos/{{owner}}/{{repo}}/issues',
          method: 'POST',
          bodyTemplate: {
            title: '{{title}}',
            body: '{{body}}',
          },
        },
      },
      {
        id: 'add_comment_to_issue',
        title: 'Add Comment to Issue',
        description: 'Add a comment to an existing issue.',
        scopes: ['repo'],
        api: {
          url: 'https://api.github.com/repos/{{owner}}/{{repo}}/issues/{{issue_number}}/comments',
          method: 'POST',
          bodyTemplate: {
            body: '{{comment}}',
          },
        },
      },
      {
        id: 'close_issue',
        title: 'Close Issue',
        description: 'Close an issue.',
        scopes: ['repo'],
        api: {
          url: 'https://api.github.com/repos/{{owner}}/{{repo}}/issues/{{issue_number}}',
          method: 'PATCH',
          bodyTemplate: {
            state: 'closed',
          },
        },
      },
      {
        id: 'assign_issue',
        title: 'Assign Issue',
        description: 'Assign an issue to a user.',
        scopes: ['repo'],
        api: {
          url: 'https://api.github.com/repos/{{owner}}/{{repo}}/issues/{{issue_number}}',
          method: 'PATCH',
          bodyTemplate: {
            assignees: ['{{assignee}}'],
          },
        },
      },
    ],

    get scopes() {
      return [...this.triggerScopes, ...this.actionScopes];
    },
  },

  webhook: {
    id: '4',
    displayName: 'Webhook',
    logo: 'http://localhost:2000/logos/webhook.png',
    triggerScopes: [],
    actionScopes: [],

    triggers: [
      {
        id: 'webhook',
        title: 'Webhook Received',
        description: 'Trigger when a webhook is received at a specific URL.',
        scopes: [],
        api: {
          url: '{{webhook_url}}',
          method: 'POST',
          pollingInterval: 0, // Real-time
        },
      },
    ],
    actions: [
      {
        id: 'send_webhook',
        title: 'Send Webhook',
        description: 'Send data to a webhook URL.',
        scopes: [],
        api: {
          url: '{{webhook_url}}',
          method: 'POST',
          bodyTemplate: {
            data: '{{trigger_data}}',
            timestamp: '{{timestamp}}',
          },
        },
      },
    ],

    get scopes() {
      return [...this.triggerScopes, ...this.actionScopes];
    },
  },
} as const;

export type SupportedApp = keyof typeof AppsCatalog;

/**
 * Get the OAuth provider name for a given app.
 * For apps like Gmail that use Google OAuth, returns 'google'.
 * Otherwise returns the app name itself.
 */
export function getOAuthProvider(app: SupportedApp): string {
  const appConfig = AppsCatalog[app];
  return (appConfig as any).oauthProvider || app;
}

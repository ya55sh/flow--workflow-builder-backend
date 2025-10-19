// apps.config.ts

export const AppsCatalog = {
  google: {
    id: '1',
    displayName: 'Gmail',
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
    ],

    get scopes() {
      return [...this.triggerScopes, ...this.actionScopes];
    },
  },

  slack: {
    id: '2',
    displayName: 'Slack',
    logo: 'http://localhost:2000/logos/slack.png',
    triggerScopes: ['channels:read', 'groups:read', 'im:read', 'mpim:read'],
    actionScopes: ['chat:write'],

    triggers: [
      {
        id: 'new_channel_message',
        title: 'New message in channel',
        description: 'Trigger when a new message is posted to a channel.',
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
        scopes: ['chat:write'],
        api: {
          url: 'https://slack.com/api/chat.postMessage',
          method: 'POST',
          bodyTemplate: {
            channel: '{{channel_id}}',
            text: '{{message}}',
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
    ],

    get scopes() {
      return [...this.triggerScopes, ...this.actionScopes];
    },
  },
} as const;

export type SupportedApp = keyof typeof AppsCatalog;

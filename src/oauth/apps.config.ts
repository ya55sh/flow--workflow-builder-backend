// apps.config.ts

export const AppsCatalog = {
  google: {
    id: '1',
    displayName: 'Gmail',
    logo: 'http://localhost:2000/logos/gmail.png',
    authType: 'oauth2',
    authUrl:
      process.env.GOOGLE_AUTH_URI ||
      'https://accounts.google.com/o/oauth2/auth',
    tokenUrl:
      process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token',

    neutralScopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    triggerScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    actionScopes: ['https://www.googleapis.com/auth/gmail.send'],

    get scopes() {
      return [
        ...this.neutralScopes,
        ...this.triggerScopes,
        ...this.actionScopes,
      ];
    },
  },

  slack: {
    id: '2',
    displayName: 'Slack',
    logo: 'http://localhost:2000/logos/slack.png',
    authType: 'oauth2',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',

    neutralScopes: ['identity.basic', 'identity.email'],
    triggerScopes: ['channels:read', 'groups:read', 'im:read', 'mpim:read'],
    actionScopes: ['chat:write', 'channels:read'],

    get scopes() {
      return [
        ...this.neutralScopes,
        ...this.triggerScopes,
        ...this.actionScopes,
      ];
    },
  },

  github: {
    id: '3',
    displayName: 'GitHub',
    logo: 'http://localhost:2000/logos/github-sign.png',
    authType: 'oauth2',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',

    neutralScopes: ['read:user', 'user:email'],
    triggerScopes: ['repo'],
    actionScopes: ['repo'],

    get scopes() {
      return [
        ...this.neutralScopes,
        ...this.triggerScopes,
        ...this.actionScopes,
      ];
    },
  },
} as const;

export type SupportedApp = keyof typeof AppsCatalog;

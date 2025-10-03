// apps.config.ts
export const AppsCatalog = {
  google: {
    authUrl:
      process.env.GOOGLE_AUTH_URI ||
      'https://accounts.google.com/o/oauth2/auth',
    tokenUrl:
      process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    scopes: ['email', 'profile', 'gmail.readonly', 'gmail.send'],
  },
  slack: {
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['chat:write', 'channels:read'],
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'user:email'],
  },
} as const;

export type SupportedApp = keyof typeof AppsCatalog;

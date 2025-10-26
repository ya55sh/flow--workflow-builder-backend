import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserApp } from '../db/db.user_app';
import { User } from '../db/db.user';
import { SupportedApp, AppsCatalog, getOAuthProvider } from './apps.config';

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  [key: string]: any;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  refresh_token?: string;
}

export interface ExchangeCodeForTokensResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  metadata: any;
}

@Injectable()
export class OauthService {
  constructor(
    @InjectRepository(UserApp)
    private readonly userAppsRepo: Repository<UserApp>,
  ) {}

  async exchangeCodeForTokens(
    app: SupportedApp,
    code: string,
  ): Promise<ExchangeCodeForTokensResult> {
    const oauthProvider = getOAuthProvider(app);

    const clientId = process.env[`${oauthProvider.toUpperCase()}_CLIENT_ID`];
    const clientSecret =
      process.env[`${oauthProvider.toUpperCase()}_CLIENT_SECRET`];
    const redirectUri =
      process.env[`${oauthProvider.toUpperCase()}_REDIRECT_URI`];
    const tokenUrl = process.env[`${oauthProvider.toUpperCase()}_TOKEN_URI`];

    let payload: Record<string, string> = {};
    const headers: Record<string, string> = {};

    // Different providers expect different formats:
    if (oauthProvider === 'slack') {
      payload = {
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri!,
      };
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (oauthProvider === 'google') {
      payload = {
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri!,
        grant_type: 'authorization_code',
      };
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (oauthProvider === 'github') {
      payload = {
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri!,
      };
      headers['Accept'] = 'application/json';
    }

    const res = await axios.post<OAuthTokenResponse>(
      tokenUrl!,
      new URLSearchParams(payload),
      { headers },
    );

    if (!res.data) throw new Error(`${app} OAuth failed`);

    return {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      expiresIn: res.data.expires_in,
      metadata: res.data,
    };
  }

  async saveUserApp(
    state: string,
    app: SupportedApp,
    tokens: ExchangeCodeForTokensResult,
  ) {
    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    const user = await this.userAppsRepo.manager.findOne(User, {
      where: { id: Number(state) },
    });

    let userApp = await this.userAppsRepo.findOne({
      where: { user: { id: Number(state) }, appName: app },
    });

    if (!userApp) {
      userApp = this.userAppsRepo.create({
        user,
        appName: app,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        expiresAt: expiresAt ?? null,
        metadata: tokens.metadata ?? {},
      } as Partial<UserApp>);
    } else {
      userApp.accessToken = tokens.accessToken;
      userApp.refreshToken = tokens.refreshToken!;
      userApp.expiresAt = expiresAt!;
      userApp.metadata = tokens.metadata;
    }

    return this.userAppsRepo.save(userApp);
  }

  async checkUserAppStatus(user: User, appName: string) {
    const existing = await this.userAppsRepo.findOne({
      where: { user: { id: user.id }, appName },
    });

    if (!existing) {
      return { connected: false };
    }

    const isExpired =
      existing.expiresAt && new Date(existing.expiresAt) < new Date();

    return {
      connected: true,
      appName: existing.appName,
      expiresAt: existing.expiresAt,
      expired: !!isExpired,
    };
  }

  async generateAccessToken(
    user: User,
    appName: string,
  ): Promise<{ message: string; expiresAt: Date }> {
    const userApp = await this.userAppsRepo.findOne({
      where: {
        user: { id: user.id },
        appName: appName,
      },
    });

    if (!userApp) {
      throw new Error(`No app found for user ${user.id} with name ${appName}`);
    }

    console.log('userapp, ', userApp);

    // Get OAuth provider from AppsCatalog
    const oauthProvider = AppsCatalog[appName as SupportedApp]
      ? getOAuthProvider(appName as SupportedApp)
      : appName;

    const clientId = process.env?.[`${oauthProvider.toUpperCase()}_CLIENT_ID`];
    const redirectUri =
      process.env?.[`${oauthProvider.toUpperCase()}_REDIRECT_URI`];
    const clientSecret =
      process.env?.[`${oauthProvider.toUpperCase()}_CLIENT_SECRET`];
    const refreshToken = userApp.metadata.refresh_token;
    const tokenUrl = process.env?.[`${oauthProvider.toUpperCase()}_TOKEN_URI`];

    if (!clientId || !clientSecret || !tokenUrl) {
      throw new Error('Missing OAuth credentials in environment variables');
    }

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');
    if (redirectUri) params.append('redirect_uri', redirectUri);

    try {
      const response = await axios.post<TokenResponse>(
        tokenUrl,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
      console.log('from generate access token ', response.data);

      const newExpiry = new Date(Date.now() + response.data.expires_in! * 1000); //convert token time to ms and add it to current time and convert it to iso date

      userApp.accessToken = response.data.access_token;
      userApp.expiresAt = newExpiry;
      await this.userAppsRepo.save(userApp).catch((err) => {
        console.log(err.message);
      });

      return { message: 'success', expiresAt: newExpiry };
    } catch (err: any) {
      const errorMsg = err.response?.data?.error_description || err.message;
      console.error(`Token refresh failed for ${appName}: ${errorMsg}`);
      throw new Error(`Token expired. Please reconnect ${appName}.`);
    }
  }
}

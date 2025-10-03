import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserApp } from '../db/db.user_app';
import { User } from '../db/db.user';
import { SupportedApp, AppsCatalog } from './apps.config';

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  [key: string]: any;
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
    const appConfig = AppsCatalog[app];
    const clientId = process.env[`${app.toUpperCase()}_CLIENT_ID`];
    const clientSecret = process.env[`${app.toUpperCase()}_CLIENT_SECRET`];
    const redirectUri = process.env[`${app.toUpperCase()}_REDIRECT_URI`];

    let payload: Record<string, string> = {};
    const headers: Record<string, string> = {};

    // Different providers expect different formats:
    if (app === 'slack') {
      payload = {
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri!,
      };
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (app === 'google') {
      payload = {
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri!,
        grant_type: 'authorization_code',
      };
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (app === 'github') {
      payload = {
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri!,
      };
      headers['Accept'] = 'application/json';
    }

    const res = await axios.post<OAuthTokenResponse>(
      appConfig.tokenUrl,
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
    user: User,
    app: SupportedApp,
    tokens: ExchangeCodeForTokensResult,
  ) {
    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    let userApp = await this.userAppsRepo.findOne({
      where: { user: { id: user.id }, appName: app },
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
}

import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Param,
  UseGuards,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { OauthService } from './oauth.service';
import type { SupportedApp } from './apps.config';
import { AppsCatalog } from './apps.config';
import { AuthGuard } from 'src/auth/auth.guard';

// Apply AuthGuard to all routes in this controller

@Controller('oauth/app')
// @UseGuards(AuthGuard)
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  // Step 1: redirect user to app's OAuth page
  @Get(':app')
  redirectToApp(
    @Req() req: Request,
    @Param('app') app: SupportedApp,
    @Res() res: Response,
    @Query('state') state: string,
  ) {
    const appConfig = AppsCatalog[app];

    if (!appConfig) throw new Error('Unsupported app');

    const clientId = process.env?.[`${app.toUpperCase()}_CLIENT_ID`];
    const redirectUri = process.env?.[`${app.toUpperCase()}_REDIRECT_URI`];
    const authUrl = process.env?.[`${app.toUpperCase()}_AUTH_URI`];
    const scope = appConfig.scopes.join(' ');

    console.log('Preparing to redirect to OAuth URL with params:', {
      clientId,
      redirectUri,
      scope,
      state,
    });
    let url = '';
    if (app === 'google') {
      url = `${authUrl}?client_id=${clientId}&scope=${encodeURIComponent(
        scope,
      )}&redirect_uri=${encodeURIComponent(redirectUri!)}&response_type=code&state=${state}&access_type=offline&prompt=consent`;
    } else {
      url = `${authUrl}?client_id=${clientId}&scope=${encodeURIComponent(
        scope,
      )}&redirect_uri=${encodeURIComponent(redirectUri!)}&response_type=code&state=${state}`;
    }

    console.log('redirect URL:', url);

    return res.redirect(url);
  }

  // Step 2: callback (handles all apps generically)
  @Get(':app/callback')
  async handleCallback(
    @Param('app') app: SupportedApp,
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tokens = await this.oauthService.exchangeCodeForTokens(app, code);
    console.log('Received tokens:', tokens);
    await this.oauthService.saveUserApp(state, app, tokens);

    return res.json({ message: `${app} connected`, tokens });
  }

  @Get('/status/:appName')
  @UseGuards(AuthGuard)
  async getAppStatus(
    @Req() req: Request,
    @Param('appName') appName: string,
    @Res() res: Response,
  ) {
    const status = await this.oauthService.checkUserAppStatus(
      req.user,
      appName,
    );
    if (status) {
      return res.status(200).json({ status });
    } else {
      return res
        .status(404)
        .json({ connected: false, message: 'App not connected' });
    }
  }

  @Post('/access/:appName')
  @UseGuards(AuthGuard)
  async generateAccessToken(
    @Req() req: Request,
    @Res() res: Response,
    @Param('appName') appName: string,
  ) {
    const accessToken = await this.oauthService.generateAccessToken(
      req.user,
      appName,
    );
    if (accessToken) return res.status(200).json({ message: 'success' });
  }
}

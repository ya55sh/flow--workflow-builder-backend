import {
  Controller,
  Get,
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

@Controller('oauth')
@UseGuards(AuthGuard)
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  // Step 1: redirect user to app's OAuth page
  @Get(':app')
  redirectToApp(@Param('app') app: SupportedApp, @Res() res: Response) {
    const appConfig = AppsCatalog[app];
    if (!appConfig) throw new Error('Unsupported app');

    const clientId = process.env[`${app.toUpperCase()}_CLIENT_ID`];
    const redirectUri = process.env[`${app.toUpperCase()}_REDIRECT_URI`];
    const scope = appConfig.scopes.join(' ');

    const url = `${appConfig.authUrl}?client_id=${clientId}&scope=${encodeURIComponent(
      scope,
    )}&redirect_uri=${encodeURIComponent(redirectUri!)}&response_type=code`;

    return res.redirect(url);
  }

  // Step 2: callback (handles all apps generically)
  @Get(':app/callback')
  async handleCallback(
    @Param('app') app: SupportedApp,
    @Query('code') code: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    //const user = req.user; // assume auth middleware sets this

    const tokens = await this.oauthService.exchangeCodeForTokens(app, code);
    await this.oauthService.saveUserApp(req.user, app, tokens);

    return res.json({ message: `${app} connected`, tokens });
  }
}

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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { OauthService } from './oauth.service';
import type { SupportedApp } from './apps.config';
import { AppsCatalog, getOAuthProvider } from './apps.config';
import { AuthGuard } from 'src/auth/auth.guard';

// Apply AuthGuard to all routes in this controller

@ApiTags('OAuth')
@Controller('oauth/app')
// @UseGuards(AuthGuard)
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  // Step 1: redirect user to app's OAuth page
  @Get(':app')
  @ApiOperation({
    summary: 'Initiate OAuth flow',
    description:
      'Redirects user to the OAuth provider (Google, Slack, GitHub) for authorization',
  })
  @ApiParam({
    name: 'app',
    description: 'App to connect',
    enum: ['gmail', 'slack', 'github'],
    example: 'gmail',
  })
  @ApiQuery({
    name: 'state',
    description: 'User ID or session identifier for OAuth state management',
    example: '9',
    required: true,
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to OAuth provider authorization page',
  })
  @ApiResponse({
    status: 400,
    description: 'Unsupported app or invalid parameters',
  })
  redirectToApp(
    @Req() req: Request,
    @Param('app') app: SupportedApp,
    @Res() res: Response,
    @Query('state') state: string,
  ) {
    const appConfig = AppsCatalog[app];

    if (!appConfig) throw new Error('Unsupported app');

    // Use oauthProvider if defined, otherwise use app name
    const oauthProvider = getOAuthProvider(app);
    const clientId = process.env?.[`${oauthProvider.toUpperCase()}_CLIENT_ID`];
    const redirectUri =
      process.env?.[`${oauthProvider.toUpperCase()}_REDIRECT_URI`];
    const authUrl = process.env?.[`${oauthProvider.toUpperCase()}_AUTH_URI`];
    const scope = appConfig.scopes.join(' ');

    console.log('Preparing to redirect to OAuth URL with params:', {
      clientId,
      redirectUri,
      scope,
      state,
    });
    let url = '';
    if (oauthProvider === 'google') {
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
  @ApiOperation({
    summary: 'OAuth callback handler',
    description:
      'Handles OAuth callback from provider, exchanges code for tokens, and saves connection',
  })
  @ApiParam({
    name: 'app',
    description: 'App that was authorized',
    enum: ['gmail', 'slack', 'github'],
    example: 'gmail',
  })
  @ApiQuery({
    name: 'code',
    description: 'Authorization code from OAuth provider',
    required: true,
  })
  @ApiQuery({
    name: 'state',
    description: 'State parameter (user ID) passed in authorization request',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'App connected successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'gmail connected' },
        tokens: {
          type: 'object',
          properties: {
            access_token: { type: 'string', example: 'ya29.a0...' },
            refresh_token: { type: 'string', example: '1//0g...' },
            expires_in: { type: 'number', example: 3599 },
            token_type: { type: 'string', example: 'Bearer' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to exchange code or save tokens',
    schema: {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'Invalid authorization code' },
      },
    },
  })
  async handleCallback(
    @Param('app') app: SupportedApp,
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    console.log('CALLBACK HIT! App:', app);
    console.log('Query params:', {
      code: code?.substring(0, 20) + '...',
      state,
    });
    console.log('Full URL:', req.url);
    console.log('Headers:', req.headers);

    try {
      const tokens = await this.oauthService.exchangeCodeForTokens(app, code);
      console.log('Received tokens:', tokens);

      await this.oauthService.saveUserApp(state, app, tokens);
      console.log('Saved user app successfully');

      return res.json({ message: `${app} connected`, tokens });
    } catch (error: any) {
      console.error('Error in callback:', error.message);
      console.error('Full error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  @Get('/status/:appName')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Check app connection status',
    description: 'Returns whether the user has connected a specific app',
  })
  @ApiParam({
    name: 'appName',
    description: 'Name of the app to check',
    enum: ['gmail', 'slack', 'github'],
    example: 'gmail',
  })
  @ApiResponse({
    status: 200,
    description: 'App connection status',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'object',
          properties: {
            connected: { type: 'boolean', example: true },
            appName: { type: 'string', example: 'gmail' },
            connectedAt: {
              type: 'string',
              example: '2025-10-25T08:00:00.000Z',
            },
            metadata: {
              type: 'object',
              properties: {
                email: { type: 'string', example: 'user@gmail.com' },
                scope: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'App not connected',
    schema: {
      type: 'object',
      properties: {
        connected: { type: 'boolean', example: false },
        message: { type: 'string', example: 'App not connected' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Generates a new access token using refresh token (if expired)',
  })
  @ApiParam({
    name: 'appName',
    description: 'Name of the app to refresh token for',
    enum: ['gmail', 'slack', 'github'],
    example: 'gmail',
  })
  @ApiResponse({
    status: 200,
    description: 'Access token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'success' },
        accessToken: { type: 'string', example: 'ya29.a0...' },
        expiresAt: {
          type: 'string',
          example: '2025-10-26T11:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'App not connected or refresh token not available',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  async generateAccessToken(
    @Req() req: Request,
    @Res() res: Response,
    @Param('appName') appName: string,
  ) {
    const accessToken = await this.oauthService.generateAccessToken(
      req.user,
      appName,
    );
    if (accessToken.message === 'success')
      return res.status(200).json(accessToken);
  }
}

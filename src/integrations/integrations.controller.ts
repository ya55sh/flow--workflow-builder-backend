import { Controller, Get, UseGuards, Req, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@ApiBearerAuth('JWT-auth')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('slack/channels')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'List all Slack channels',
    description:
      'Retrieves a list of all channels in the connected Slack workspace. Requires the user to have connected their Slack account via OAuth.',
  })
  @ApiResponse({
    status: 200,
    description: 'Slack channels retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Slack channels retrieved successfully',
        },
        channels: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'C1234567890' },
              name: { type: 'string', example: 'general' },
              is_private: { type: 'boolean', example: false },
              is_archived: { type: 'boolean', example: false },
              is_member: { type: 'boolean', example: true },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Slack account not connected or access token expired',
  })
  async listSlackChannels(@Req() req: any) {
    const user = req.user;
    const channels = await this.integrationsService.callSlackAPI(
      user,
      'listChannels',
    );

    return {
      message: 'Slack channels retrieved successfully',
      channels,
    };
  }

  @Get('slack/workspace')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get Slack workspace information',
    description:
      'Retrieves information about the connected Slack workspace including workspace name, domain, and other details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Slack workspace info retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Slack workspace info retrieved successfully',
        },
        workspace: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'T1234567890' },
            name: { type: 'string', example: 'My Workspace' },
            domain: { type: 'string', example: 'myworkspace' },
            email_domain: { type: 'string', example: 'example.com' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Slack account not connected or access token expired',
  })
  async getSlackWorkspace(@Req() req: any) {
    const user = req.user;
    const workspace = await this.integrationsService.callSlackAPI(
      user,
      'getWorkspaceInfo',
    );

    return {
      message: 'Slack workspace info retrieved successfully',
      workspace,
    };
  }

  @Get('slack/me')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get current Slack user',
    description:
      'Retrieves information about the currently authenticated Slack user including their profile, display name, and status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current Slack user retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Current Slack user retrieved successfully',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'U1234567890' },
            name: { type: 'string', example: 'john.doe' },
            real_name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john.doe@example.com' },
            is_admin: { type: 'boolean', example: false },
            is_bot: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Slack account not connected or access token expired',
  })
  async getSlackCurrentUser(@Req() req: any) {
    const user = req.user;
    const currentUser = await this.integrationsService.callSlackAPI(
      user,
      'getCurrentUser',
    );

    return {
      message: 'Current Slack user retrieved successfully',
      user: currentUser,
    };
  }

  @Get('slack/users')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'List all Slack users',
    description:
      'Retrieves a list of all users in the connected Slack workspace including their profiles and status information.',
  })
  @ApiResponse({
    status: 200,
    description: 'Slack users retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Slack users retrieved successfully',
        },
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'U1234567890' },
              name: { type: 'string', example: 'john.doe' },
              real_name: { type: 'string', example: 'John Doe' },
              email: { type: 'string', example: 'john.doe@example.com' },
              is_bot: { type: 'boolean', example: false },
              deleted: { type: 'boolean', example: false },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Slack account not connected or access token expired',
  })
  async listSlackUsers(@Req() req: any) {
    const user = req.user;
    const users = await this.integrationsService.callSlackAPI(
      user,
      'listUsers',
    );

    return {
      message: 'Slack users retrieved successfully',
      users,
    };
  }

  @Get('slack/user/:userId')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get a specific Slack user',
    description:
      'Retrieves detailed information about a specific Slack user by their user ID.',
  })
  @ApiParam({
    name: 'userId',
    description: 'The Slack user ID to retrieve',
    example: 'U1234567890',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Slack user retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Slack user retrieved successfully',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'U1234567890' },
            name: { type: 'string', example: 'john.doe' },
            real_name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john.doe@example.com' },
            title: { type: 'string', example: 'Software Engineer' },
            phone: { type: 'string', example: '+1-555-1234' },
            status_text: { type: 'string', example: 'In a meeting' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Slack account not connected or access token expired',
  })
  @ApiResponse({
    status: 404,
    description: 'Slack user not found',
  })
  async getSlackUser(@Req() req: any, @Param('userId') userId: string) {
    const user = req.user;
    const userInfo = await this.integrationsService.callSlackAPI(
      user,
      'getUserInfo',
      { userId },
    );

    return {
      message: 'Slack user retrieved successfully',
      user: userInfo,
    };
  }

  // Gmail endpoints
  @Get('gmail/labels')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'List all Gmail labels',
    description:
      'Retrieves a list of all labels (folders) in the connected Gmail account including system labels and custom user-created labels.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gmail labels retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Gmail labels retrieved successfully',
        },
        labels: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'Label_123' },
              name: { type: 'string', example: 'Important' },
              type: {
                type: 'string',
                example: 'user',
                enum: ['system', 'user'],
              },
              messageListVisibility: {
                type: 'string',
                example: 'show',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Gmail account not connected or access token expired',
  })
  async listGmailLabels(@Req() req: any) {
    const user = req.user;
    const labels = await this.integrationsService.callGmailAPI(
      user,
      'listLabels',
    );

    return {
      message: 'Gmail labels retrieved successfully',
      labels,
    };
  }

  @Get('gmail/profile')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get Gmail profile information',
    description:
      'Retrieves profile information for the connected Gmail account including email address, message counts, and history ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gmail profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Gmail profile retrieved successfully',
        },
        profile: {
          type: 'object',
          properties: {
            emailAddress: {
              type: 'string',
              example: 'user@example.com',
            },
            messagesTotal: { type: 'number', example: 1234 },
            threadsTotal: { type: 'number', example: 567 },
            historyId: { type: 'string', example: '123456' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Gmail account not connected or access token expired',
  })
  async getGmailProfile(@Req() req: any) {
    const user = req.user;
    const profile = await this.integrationsService.callGmailAPI(
      user,
      'getProfile',
    );

    return {
      message: 'Gmail profile retrieved successfully',
      profile,
    };
  }

  // GitHub endpoints
  @Get('github/repos')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'List all GitHub repositories',
    description:
      'Retrieves a list of all repositories accessible by the connected GitHub account including both owned and collaborated repositories.',
  })
  @ApiResponse({
    status: 200,
    description: 'GitHub repositories retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'GitHub repositories retrieved successfully',
        },
        repos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 123456789 },
              name: { type: 'string', example: 'my-repo' },
              full_name: { type: 'string', example: 'user/my-repo' },
              private: { type: 'boolean', example: false },
              description: {
                type: 'string',
                example: 'A sample repository',
              },
              default_branch: { type: 'string', example: 'main' },
              html_url: {
                type: 'string',
                example: 'https://github.com/user/my-repo',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'GitHub account not connected or access token expired',
  })
  async listGitHubRepos(@Req() req: any) {
    const user = req.user;
    const repos = await this.integrationsService.callGitHubAPI(
      user,
      'listRepos',
    );

    return {
      message: 'GitHub repositories retrieved successfully',
      repos,
    };
  }

  @Get('github/user')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get current GitHub user',
    description:
      'Retrieves information about the currently authenticated GitHub user including profile details, statistics, and account type.',
  })
  @ApiResponse({
    status: 200,
    description: 'GitHub user retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'GitHub user retrieved successfully',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 12345678 },
            login: { type: 'string', example: 'johndoe' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john@example.com' },
            bio: { type: 'string', example: 'Software Developer' },
            public_repos: { type: 'number', example: 42 },
            followers: { type: 'number', example: 100 },
            following: { type: 'number', example: 50 },
            html_url: {
              type: 'string',
              example: 'https://github.com/johndoe',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'GitHub account not connected or access token expired',
  })
  async getGitHubUser(@Req() req: any) {
    const user = req.user;
    const githubUser = await this.integrationsService.callGitHubAPI(
      user,
      'getCurrentUser',
    );

    return {
      message: 'GitHub user retrieved successfully',
      user: githubUser,
    };
  }

  @Get('github/repos/:owner/:repo/branches')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'List branches for a GitHub repository',
    description:
      'Retrieves a list of all branches for a specific GitHub repository including branch names, commit SHAs, and protection status.',
  })
  @ApiParam({
    name: 'owner',
    description:
      'The GitHub username or organization name that owns the repository',
    example: 'octocat',
    type: String,
  })
  @ApiParam({
    name: 'repo',
    description: 'The name of the repository',
    example: 'hello-world',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'GitHub branches retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'GitHub branches retrieved successfully',
        },
        branches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'main' },
              commit: {
                type: 'object',
                properties: {
                  sha: {
                    type: 'string',
                    example: 'abc123def456',
                  },
                  url: {
                    type: 'string',
                    example:
                      'https://api.github.com/repos/octocat/hello-world/commits/abc123def456',
                  },
                },
              },
              protected: { type: 'boolean', example: true },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'GitHub account not connected or access token expired',
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found or not accessible',
  })
  async listGitHubBranches(
    @Req() req: any,
    @Param('owner') owner: string,
    @Param('repo') repo: string,
  ) {
    const user = req.user;
    const branches = await this.integrationsService.callGitHubAPI(
      user,
      'listBranches',
      { owner, repo },
    );

    return {
      message: 'GitHub branches retrieved successfully',
      branches,
    };
  }
}

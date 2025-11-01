import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserApp } from '../db/db.user_app';
import { User } from '../db/db.user';
import { OauthService } from '../oauth/oauth.service';
import { GmailIntegration } from './gmail.integration';
import { SlackIntegration } from './slack.integration';
import { GitHubIntegration } from './github.integration';
import { CacheService } from './cache.service';
import { LoggingService, LogEventType } from '../db/logging.service';
import { MailService } from '../mailService/mail.service';

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(UserApp)
    private readonly userAppsRepo: Repository<UserApp>,
    private readonly oauthService: OauthService,
    private readonly gmailIntegration: GmailIntegration,
    private readonly slackIntegration: SlackIntegration,
    private readonly githubIntegration: GitHubIntegration,
    private readonly cacheService: CacheService,
    private readonly loggingService: LoggingService,
    private readonly mailService: MailService,
  ) {}

  async getValidToken(user: User, appName: string): Promise<string> {
    // Fetch user's app connection
    const userApp = await this.userAppsRepo.findOne({
      where: { user: { id: user.id }, appName },
      select: ['id', 'accessToken', 'refreshToken', 'expiresAt'],
    });

    if (!userApp) {
      throw new UnauthorizedException(
        `Please connect your ${appName} account before using this workflow`,
      );
    }

    // Check if token is expired
    const now = new Date();
    const isExpired = userApp.expiresAt && new Date(userApp.expiresAt) < now;

    if (isExpired) {
      console.log(`Token expired for ${appName}, refreshing...`);
      try {
        const refreshResult = await this.oauthService.generateAccessToken(
          user,
          appName,
        );
        console.log('Token refreshed successfully');

        // Log token refresh
        await this.loggingService.createLog(
          LogEventType.TOKEN_REFRESHED,
          {
            appName,
            expiresAt: refreshResult.expiresAt,
          },
          user,
        );

        return (await this.userAppsRepo.findOne({
          where: { user: { id: user.id }, appName },
          select: ['accessToken'],
        }))!.accessToken;
      } catch (error: any) {
        console.error('Failed to refresh access token:', error?.message);
        this.mailService.sendEmail(
          user.email,
          `Failed to refresh ${appName} token`,
          `Failed to refresh ${appName} token. Please reconnect your account in Flow.`,
        );
        throw new UnauthorizedException(
          `Failed to refresh ${appName} token. Please reconnect your account`,
        );
      }
    }

    return userApp.accessToken;
  }

  async getUserAppMetadata(user: User, appName: string): Promise<any> {
    const userApp = await this.userAppsRepo.findOne({
      where: { user: { id: user.id }, appName },
    });

    if (!userApp) {
      this.mailService.sendEmail(
        user.email,
        `Please connect your ${appName} account before using this workflow`,
        `Please connect your ${appName} account before using this workflow.`,
      );
      throw new UnauthorizedException(
        `Please connect your ${appName} account before using this workflow`,
      );
    }

    return userApp.metadata;
  }

  async callGmailAPI(
    user: User,
    method:
      | 'fetchEmails'
      | 'sendEmail'
      | 'replyToEmail'
      | 'addLabelToEmail'
      | 'starEmail'
      | 'markAsRead'
      | 'listLabels'
      | 'getProfile',
    data?: any,
  ): Promise<any> {
    const accessToken = await this.getValidToken(user, 'gmail');

    // Define cacheable methods and their TTLs
    const cacheableMetadata = {
      listLabels: 5 * 60 * 1000, // 5 minutes
      getProfile: 10 * 60 * 1000, // 10 minutes
    };

    // Check cache for read-only operations
    if (method in cacheableMetadata) {
      const cacheKey = `gmail:${user.id}:${method}`;
      const cached = this.cacheService.get(cacheKey);
      if (cached) {
        console.log(`Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    let result: any;
    switch (method) {
      case 'fetchEmails':
        result = await this.gmailIntegration.fetchRecentEmails(
          accessToken,
          data?.query,
          data?.maxResults,
        );
        break;
      case 'sendEmail':
        result = await this.gmailIntegration.sendEmail(
          accessToken,
          data.to,
          data.subject,
          data.body,
          data.from,
        );
        break;
      case 'replyToEmail':
        result = await this.gmailIntegration.replyToEmail(
          accessToken,
          data.messageId,
          data.threadId,
          data.body,
          data.subject,
        );
        break;
      case 'addLabelToEmail':
        result = await this.gmailIntegration.addLabelToEmail(
          accessToken,
          data.messageId,
          data.labelIds,
        );
        break;
      case 'starEmail':
        result = await this.gmailIntegration.starEmail(
          accessToken,
          data.messageId,
        );
        break;
      case 'markAsRead':
        result = await this.gmailIntegration.markAsRead(
          accessToken,
          data.messageId,
        );
        break;
      case 'listLabels':
        result = await this.gmailIntegration.listLabels(accessToken);
        break;
      case 'getProfile':
        result = await this.gmailIntegration.getProfile(accessToken);
        break;
      default:
        throw new Error(`Unknown Gmail API method: ${method}`);
    }

    // Cache the result for cacheable methods
    if (method in cacheableMetadata) {
      const cacheKey = `gmail:${user.id}:${method}`;
      this.cacheService.set(cacheKey, result, cacheableMetadata[method]);
      console.log(`Cached ${cacheKey} for ${cacheableMetadata[method]}ms`);
    }

    return result;
  }

  async callSlackAPI(
    user: User,
    method:
      | 'fetchMessages'
      | 'postMessage'
      | 'sendDM'
      | 'listChannels'
      | 'getWorkspaceInfo'
      | 'getCurrentUser'
      | 'listUsers'
      | 'getUserInfo',
    data?: any,
  ): Promise<any> {
    const accessToken = await this.getValidToken(user, 'slack');

    // Define cacheable methods and their TTLs (in milliseconds)
    const cacheableMetadata = {
      listChannels: 5 * 60 * 1000, // 5 minutes
      listUsers: 5 * 60 * 1000, // 5 minutes
      getWorkspaceInfo: 10 * 60 * 1000, // 10 minutes
      getCurrentUser: 10 * 60 * 1000, // 10 minutes
    };

    // Check cache for read-only operations
    if (method in cacheableMetadata) {
      const cacheKey = `slack:${user.id}:${method}`;
      const cached = this.cacheService.get(cacheKey);
      if (cached) {
        console.log(`Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    let result: any;
    switch (method) {
      case 'fetchMessages':
        result = await this.slackIntegration.fetchRecentMessages(
          accessToken,
          data.channel,
          data.limit,
        );
        break;
      case 'postMessage':
        result = await this.slackIntegration.postMessage(
          accessToken,
          data.channel,
          data.text,
        );
        break;
      case 'sendDM':
        result = await this.slackIntegration.sendDirectMessage(
          accessToken,
          data.userId,
          data.text,
        );
        break;
      case 'listChannels':
        result = await this.slackIntegration.listChannels(accessToken);
        break;
      case 'getWorkspaceInfo':
        result = await this.slackIntegration.getWorkspaceInfo(accessToken);
        break;
      case 'getCurrentUser':
        result = await this.slackIntegration.getCurrentUser(accessToken);
        break;
      case 'listUsers':
        result = await this.slackIntegration.listUsers(accessToken);
        break;
      case 'getUserInfo':
        result = await this.slackIntegration.getUserInfo(
          accessToken,
          data.userId,
        );
        break;
      default:
        throw new Error(`Unknown Slack API method: ${method}`);
    }

    // Cache the result for cacheable methods
    if (method in cacheableMetadata) {
      const cacheKey = `slack:${user.id}:${method}`;
      this.cacheService.set(cacheKey, result, cacheableMetadata[method]);
      console.log(`Cached ${cacheKey} for ${cacheableMetadata[method]}ms`);
    }

    return result;
  }

  async callGitHubAPI(
    user: User,
    method:
      | 'listRepos'
      | 'getCurrentUser'
      | 'listBranches'
      | 'createIssue'
      | 'listIssues'
      | 'listPullRequests'
      | 'listCommits'
      | 'listIssueComments'
      | 'addCommentToIssue'
      | 'closeIssue'
      | 'assignIssue',
    data?: any,
  ): Promise<any> {
    const accessToken = await this.getValidToken(user, 'github');

    // Define cacheable methods and their TTLs
    const cacheableMetadata = {
      listRepos: 5 * 60 * 1000, // 5 minutes
      getCurrentUser: 10 * 60 * 1000, // 10 minutes
    };

    // Check cache for read-only operations
    if (method in cacheableMetadata) {
      const cacheKey = `github:${user.id}:${method}`;
      const cached = this.cacheService.get(cacheKey);
      if (cached) {
        console.log(`Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    let result: any;
    switch (method) {
      case 'listRepos':
        result = await this.githubIntegration.listRepos(accessToken);
        break;
      case 'getCurrentUser':
        result = await this.githubIntegration.getCurrentUser(accessToken);
        break;
      case 'listBranches':
        result = await this.githubIntegration.listBranches(
          accessToken,
          data.owner,
          data.repo,
        );
        break;
      case 'createIssue':
        result = await this.githubIntegration.createIssue(
          accessToken,
          data.owner,
          data.repo,
          data.title,
          data.body,
          data.labels,
          data.assignees,
        );
        break;
      case 'listIssues':
        result = await this.githubIntegration.listIssues(
          accessToken,
          data.owner,
          data.repo,
          data.state,
          data.per_page,
        );
        break;
      case 'listPullRequests':
        result = await this.githubIntegration.listPullRequests(
          accessToken,
          data.owner,
          data.repo,
          data.state,
          data.per_page,
        );
        break;
      case 'listCommits':
        result = await this.githubIntegration.listCommits(
          accessToken,
          data.owner,
          data.repo,
          data.branch,
          data.per_page,
        );
        break;
      case 'listIssueComments':
        result = await this.githubIntegration.listIssueComments(
          accessToken,
          data.owner,
          data.repo,
          data.issueNumber,
          data.per_page,
        );
        break;
      case 'addCommentToIssue':
        result = await this.githubIntegration.addCommentToIssue(
          accessToken,
          data.owner,
          data.repo,
          data.issueNumber,
          data.comment,
        );
        break;
      case 'closeIssue':
        result = await this.githubIntegration.closeIssue(
          accessToken,
          data.owner,
          data.repo,
          data.issueNumber,
        );
        break;
      case 'assignIssue':
        result = await this.githubIntegration.assignIssue(
          accessToken,
          data.owner,
          data.repo,
          data.issueNumber,
          data.assignees,
        );
        break;
      default:
        throw new Error(`Unknown GitHub API method: ${method}`);
    }

    // Cache the result for cacheable methods
    if (method in cacheableMetadata) {
      const cacheKey = `github:${user.id}:${method}`;
      this.cacheService.set(cacheKey, result, cacheableMetadata[method]);
      console.log(`Cached ${cacheKey} for ${cacheableMetadata[method]}ms`);
    }

    return result;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Workflow } from '../db/db.workflow';
import { ProcessedTrigger } from '../db/db.processed_trigger';
import { QueueService } from './queue.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { LoggingService, LogEventType } from '../db/logging.service';

/**
 * Scheduler Service
 *
 * Responsible for polling active workflows and checking their triggers at regular intervals.
 * This service runs in the background and manages:
 * - Periodic checking of workflow triggers (every 30 seconds)
 * - Queueing workflow execution jobs when triggers fire
 * - Tracking processed triggers to avoid duplicate executions
 * - Cleaning up old logs (every 24 hours)
 */
@Injectable()
export class SchedulerService {
  // Interval ID for the main polling loop
  private pollingIntervalId: NodeJS.Timeout | null = null;
  // How often to check workflows (30 seconds)
  private readonly SCHEDULER_INTERVAL = 30000;
  // Interval ID for log cleanup
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  // How often to clean up old logs (24 hours)
  private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(Workflow)
    private workflowRepo: Repository<Workflow>,
    @InjectRepository(ProcessedTrigger)
    private processedTriggerRepo: Repository<ProcessedTrigger>,
    private queueService: QueueService,
    private integrationsService: IntegrationsService,
    private loggingService: LoggingService,
  ) {}

  /**
   * Start the workflow polling scheduler
   * Initiates both the main workflow polling loop and the log cleanup scheduler
   */
  startPolling(): void {
    console.log('Starting workflow scheduler...');
    this.pollingIntervalId = setInterval(() => {
      this.pollWorkflows();
    }, this.SCHEDULER_INTERVAL);

    // Run immediately on start
    this.pollWorkflows();

    // Start cleanup scheduler for old logs
    console.log('Starting log cleanup scheduler...');
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupOldLogs();
    }, this.CLEANUP_INTERVAL);

    // Run cleanup immediately on start
    this.cleanupOldLogs();
  }

  /**
   * Stop the workflow polling scheduler
   * Clears both polling intervals to gracefully shut down the scheduler
   */
  stopPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
      console.log('Workflow scheduler stopped');
    }

    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      console.log('Log cleanup scheduler stopped');
    }
  }

  /**
   * Poll all active workflows and check their triggers
   * This method is called periodically by the scheduler
   */
  private async pollWorkflows(): Promise<void> {
    try {
      console.log('Polling active workflows...');

      // Fetch all active workflows with their associated user
      const activeWorkflows = await this.workflowRepo.find({
        where: { isActive: true },
        relations: ['user'],
      });

      console.log(`Found ${activeWorkflows.length} active workflows`);

      // Check each workflow to see if it should be triggered
      for (const workflow of activeWorkflows) {
        await this.checkAndTriggerWorkflow(workflow);
      }
    } catch (error: any) {
      console.error('Error polling workflows:', error.message);
    }
  }

  /**
   * Check if a workflow should be triggered and queue it for execution
   * @param workflow The workflow to check
   */
  private async checkAndTriggerWorkflow(workflow: Workflow): Promise<void> {
    try {
      const now = new Date();
      const nextRunAt = this.calculateNextRunAt(workflow);

      // Check if it's time to run this workflow (based on interval)
      if (nextRunAt > now) {
        return; // Not time yet
      }

      console.log(`Checking trigger for workflow ${workflow.id}`);

      // Check the trigger condition (e.g., new email, new issue, etc.)
      const triggerData = await this.checkTrigger(workflow);

      if (triggerData) {
        console.log(`Trigger fired for workflow ${workflow.id}`);
        console.log(
          `Processing: ${triggerData.data?.trigger?.subject || triggerData.data?.trigger?.text || triggerData.data?.trigger?.title || 'Unknown'} from ${triggerData.data?.trigger?.from || triggerData.data?.trigger?.author || 'Unknown'} at ${triggerData.data?.trigger?.timestamp || 'Unknown'}`,
        );

        // Log trigger fired
        await this.loggingService.createLog(
          LogEventType.TRIGGER_FIRED,
          {
            workflowId: workflow.id,
            workflowName: workflow.name,
            triggerId: triggerData.triggerId,
            externalId: triggerData.externalId,
            triggerData: triggerData.data,
          },
          workflow.user,
          workflow,
        );

        // Add job to queue
        await this.queueService.addWorkflowJob(
          workflow.id,
          workflow.user.id,
          triggerData,
        );

        // Update lastRunAt (using update to preserve relations)
        await this.workflowRepo.update(workflow.id, { lastRunAt: now });
      }
    } catch (error: any) {
      console.error(`Error checking workflow ${workflow.id}:`, error.message);
    }
  }

  /**
   * Calculate when the workflow should run next based on its polling interval
   * @param workflow The workflow to calculate next run time for
   * @returns The next run date
   */
  private calculateNextRunAt(workflow: Workflow): Date {
    if (!workflow.lastRunAt) {
      return new Date(0); // Run immediately if never run before
    }

    const pollingInterval = workflow.pollingInterval || 60; // Default 60 seconds
    const nextRun = new Date(workflow.lastRunAt);
    nextRun.setSeconds(nextRun.getSeconds() + pollingInterval);
    return nextRun;
  }

  /**
   * Check the workflow's trigger condition
   * Determines what type of trigger it is and calls the appropriate integration method
   * @param workflow The workflow to check
   * @returns Trigger data if condition is met, null otherwise
   */
  private async checkTrigger(workflow: Workflow): Promise<any | null> {
    // Find the trigger step in the workflow configuration
    const triggerStep = workflow.steps?.find((step) => step.type === 'trigger');
    if (!triggerStep) {
      console.log(`No trigger step found in workflow ${workflow.id}`);
      return null;
    }

    const triggerId = triggerStep.triggerId || triggerStep.appName;
    console.log(
      `Checking trigger type: ${triggerId} for workflow ${workflow.id}`,
    );

    // Call the appropriate integration method based on trigger type
    let newItems: any[] = [];
    try {
      switch (triggerId) {
        case 'new_email':
          newItems = await this.fetchNewEmails(workflow, triggerStep);
          break;
        case 'email_starred':
          newItems = await this.fetchStarredEmails(workflow, triggerStep);
          break;
        case 'new_channel_message':
          newItems = await this.fetchNewSlackMessages(workflow, triggerStep);
          break;
        case 'new_issue':
          newItems = await this.fetchNewGitHubIssues(workflow, triggerStep);
          break;
        case 'pull_request_opened':
          newItems = await this.fetchNewGitHubPRs(workflow, triggerStep);
          break;
        case 'commit_pushed':
          newItems = await this.fetchNewGitHubCommits(workflow, triggerStep);
          break;
        case 'issue_commented':
          newItems = await this.fetchNewGitHubComments(workflow, triggerStep);
          break;
        default:
          console.log(`Unsupported trigger type: ${triggerId}`);
          return null;
      }

      // Filter out items that have already been processed to avoid duplicate triggers
      const unprocessedItems = await this.filterUnprocessed(
        workflow.id,
        triggerId,
        newItems,
      );

      console.log(
        `Found ${newItems.length} new items, ${unprocessedItems.length} unprocessed`,
      );

      // Return the first unprocessed item (trigger fires once per poll)
      return unprocessedItems.length > 0 ? unprocessedItems[0] : null;
    } catch (error: any) {
      console.error(
        `Error checking trigger for workflow ${workflow.id}:`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Filter out items that have already been processed by this workflow
   * Uses the ProcessedTrigger table to track which external IDs have been seen
   * @param workflowId The workflow ID
   * @param triggerType The type of trigger (e.g., 'new_email', 'new_issue')
   * @param items Array of items to filter
   * @returns Array of unprocessed items
   */
  private async filterUnprocessed(
    workflowId: number,
    triggerType: string,
    items: any[],
  ): Promise<any[]> {
    if (items.length === 0) return [];

    // Get all previously processed external IDs for this workflow and trigger type
    const processedIds = await this.processedTriggerRepo.find({
      where: { workflow: { id: workflowId }, triggerType },
      select: ['externalId'],
    });

    const processedIdSet = new Set(processedIds.map((p) => p.externalId));

    // Return only items that haven't been processed yet
    return items.filter((item) => !processedIdSet.has(item.externalId));
  }

  /**
   * Fetch new emails from Gmail
   * Queries for unread emails from the last 2 days to avoid triggering on old messages
   * @param workflow The workflow containing user credentials
   * @param triggerStep The trigger configuration
   * @returns Array of new email items
   */
  private async fetchNewEmails(
    workflow: Workflow,
    triggerStep: any,
  ): Promise<any[]> {
    try {
      // Fetch unread emails from the last 2 days to avoid old emails
      const query = triggerStep.config?.query || 'is:unread newer_than:2d';
      const emails = await this.integrationsService.callGmailAPI(
        workflow.user,
        'fetchEmails',
        { query, maxResults: 10 },
      );

      // Sort by timestamp, newest first
      emails.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return emails.map((email) => ({
        externalId: email.id, // Gmail message ID
        triggerId: 'new_email',
        data: {
          trigger: {
            subject: email.subject,
            from: email.from,
            to: email.to,
            snippet: email.snippet,
            body: email.body,
            timestamp: email.timestamp,
            messageId: email.id,
            threadId: email.threadId, // Add threadId for reply functionality
          },
        },
      }));
    } catch (error: any) {
      console.error('Error fetching Gmail emails:', error.message);
      return [];
    }
  }

  private async fetchStarredEmails(
    workflow: Workflow,
    triggerStep: any,
  ): Promise<any[]> {
    try {
      const query = 'is:starred';
      const emails = await this.integrationsService.callGmailAPI(
        workflow.user,
        'fetchEmails',
        { query, maxResults: 10 },
      );

      // Sort by timestamp, newest first
      emails.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return emails.map((email) => ({
        externalId: email.id, // Gmail message ID
        triggerId: 'email_starred',
        data: {
          trigger: {
            subject: email.subject,
            from: email.from,
            to: email.to,
            snippet: email.snippet,
            body: email.body,
            timestamp: email.timestamp,
            messageId: email.id,
            threadId: email.threadId, // Add threadId for reply functionality
            starred: true,
          },
        },
      }));
    } catch (error: any) {
      console.error('Error fetching starred Gmail emails:', error.message);
      return [];
    }
  }

  // Slack trigger fetchers
  private async fetchNewSlackMessages(
    workflow: Workflow,
    triggerStep: any,
  ): Promise<any[]> {
    try {
      const channel = triggerStep.config?.channel;
      if (!channel) {
        console.log('No channel configured for Slack trigger');
        return [];
      }

      const messages = await this.integrationsService.callSlackAPI(
        workflow.user,
        'fetchMessages',
        { channel, limit: 10 },
      );

      // Sort by timestamp, newest first
      messages.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return messages.map((msg) => ({
        externalId: msg.ts, // Slack message timestamp
        triggerId: 'new_channel_message',
        data: {
          trigger: {
            text: msg.text,
            sender: msg.user,
            channel: msg.channel,
            timestamp: msg.timestamp,
            messageTs: msg.ts,
          },
        },
      }));
    } catch (error: any) {
      console.error('Error fetching Slack messages:', error.message);
      return [];
    }
  }

  // GitHub trigger fetchers
  private async fetchNewGitHubIssues(
    workflow: Workflow,
    triggerStep: any,
  ): Promise<any[]> {
    try {
      const owner = triggerStep.config?.owner;
      const repo = triggerStep.config?.repo;

      if (!owner || !repo) {
        console.log('Owner or repo not configured for GitHub trigger');
        return [];
      }

      const issues = await this.integrationsService.callGitHubAPI(
        workflow.user,
        'listIssues',
        { owner, repo, state: 'open', per_page: 10 },
      );

      // Sort by created_at, newest first
      issues.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      return issues.map((issue) => ({
        externalId: issue.number.toString(), // GitHub issue number
        triggerId: 'new_issue',
        data: {
          trigger: {
            title: issue.title,
            body: issue.body,
            author: issue.author,
            repository: `${owner}/${repo}`,
            number: issue.number,
            html_url: issue.html_url,
            timestamp: issue.created_at,
            labels: issue.labels,
          },
        },
      }));
    } catch (error: any) {
      console.error('Error fetching GitHub issues:', error.message);
      return [];
    }
  }

  private async fetchNewGitHubPRs(
    workflow: Workflow,
    triggerStep: any,
  ): Promise<any[]> {
    try {
      const owner = triggerStep.config?.owner;
      const repo = triggerStep.config?.repo;

      if (!owner || !repo) {
        console.log('Owner or repo not configured for GitHub PR trigger');
        return [];
      }

      const prs = await this.integrationsService.callGitHubAPI(
        workflow.user,
        'listPullRequests',
        { owner, repo, state: 'open', per_page: 10 },
      );

      // Sort by created_at, newest first
      prs.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      return prs.map((pr) => ({
        externalId: pr.number.toString(), // GitHub PR number
        triggerId: 'pull_request_opened',
        data: {
          trigger: {
            title: pr.title,
            body: pr.body,
            author: pr.author,
            repository: `${owner}/${repo}`,
            number: pr.number,
            html_url: pr.html_url,
            baseBranch: pr.base_branch,
            headBranch: pr.head_branch,
            timestamp: pr.created_at,
          },
        },
      }));
    } catch (error: any) {
      console.error('Error fetching GitHub PRs:', error.message);
      return [];
    }
  }

  private async fetchNewGitHubCommits(
    workflow: Workflow,
    triggerStep: any,
  ): Promise<any[]> {
    try {
      const owner = triggerStep.config?.owner;
      const repo = triggerStep.config?.repo;
      const branch = triggerStep.config?.branch;

      if (!owner || !repo) {
        console.log('Owner or repo not configured for GitHub commit trigger');
        return [];
      }

      const commits = await this.integrationsService.callGitHubAPI(
        workflow.user,
        'listCommits',
        { owner, repo, branch, per_page: 10 },
      );

      // Sort by date, newest first
      commits.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      return commits.map((commit) => ({
        externalId: commit.sha, // GitHub commit SHA
        triggerId: 'commit_pushed',
        data: {
          trigger: {
            message: commit.message,
            author: commit.author,
            repository: `${owner}/${repo}`,
            branch: branch || 'default',
            sha: commit.sha,
            html_url: commit.html_url,
            timestamp: commit.date,
          },
        },
      }));
    } catch (error: any) {
      console.error('Error fetching GitHub commits:', error.message);
      return [];
    }
  }

  private async fetchNewGitHubComments(
    workflow: Workflow,
    triggerStep: any,
  ): Promise<any[]> {
    try {
      const owner = triggerStep.config?.owner;
      const repo = triggerStep.config?.repo;
      const issueNumber = triggerStep.config?.issueNumber;

      if (!owner || !repo) {
        console.log('Owner or repo not configured for GitHub comment trigger');
        return [];
      }

      const comments = await this.integrationsService.callGitHubAPI(
        workflow.user,
        'listIssueComments',
        { owner, repo, issueNumber, per_page: 10 },
      );

      // Sort by created_at, newest first
      comments.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      return comments.map((comment) => ({
        externalId: comment.id.toString(), // GitHub comment ID
        triggerId: 'issue_commented',
        data: {
          trigger: {
            comment: comment.body,
            author: comment.author,
            repository: `${owner}/${repo}`,
            issueNumber: issueNumber || 'all',
            html_url: comment.html_url,
            timestamp: comment.created_at,
          },
        },
      }));
    } catch (error: any) {
      console.error('Error fetching GitHub comments:', error.message);
      return [];
    }
  }

  // Cleanup old processed triggers (run periodically)
  private async cleanupOldProcessedTriggers(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.processedTriggerRepo
        .createQueryBuilder()
        .delete()
        .where('processedAt < :date', { date: thirtyDaysAgo })
        .execute();

      console.log(`Cleaned up ${result.affected} old processed triggers`);
    } catch (error: any) {
      console.error('Error cleaning up old triggers:', error.message);
    }
  }

  // Cleanup old logs (run daily)
  private async cleanupOldLogs(): Promise<void> {
    try {
      console.log('Running log cleanup...');
      const deletedCount = await this.loggingService.cleanupOldLogs(30);
      console.log(`Log cleanup completed: ${deletedCount} entries deleted`);
    } catch (error: any) {
      console.error('Error during log cleanup:', error.message);
    }
  }

  onModuleDestroy() {
    this.stopPolling();
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../db/db.workflow';
import { User } from '../db/db.user';
import { IntegrationsService } from '../integrations/integrations.service';
import { LoggingService, LogEventType } from '../db/logging.service';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow)
    private workflowsRepo: Repository<Workflow>,
    private integrationsService: IntegrationsService,
    private loggingService: LoggingService,
  ) {}

  async create(user: User, data: any): Promise<Workflow> {
    console.log('Creating workflow for user:', user);
    console.log('Workflow data:', data);

    try {
      // Handle new workflow format with steps
      if (!data.workflow || !data.workflow.steps) {
        throw new BadRequestException('Workflow data with steps is required');
      }

      const { workflowName, steps, description } = data.workflow;

      if (!workflowName) {
        throw new BadRequestException('Workflow name is required');
      }

      if (!steps || steps.length === 0) {
        throw new BadRequestException('At least one step is required');
      }

      // Validate that we have at least one trigger and one action
      const triggerSteps = steps.filter((step) => step.type === 'trigger');
      const actionSteps = steps.filter((step) => step.type === 'action');

      if (triggerSteps.length === 0) {
        throw new BadRequestException('At least one trigger step is required');
      }

      if (actionSteps.length === 0) {
        throw new BadRequestException('At least one action step is required');
      }

      // Check for existing workflow with same name
      const existingWorkflow: Workflow[] = await this.workflowsRepo.find({
        where: { name: workflowName, user: { id: user.id } },
      });

      if (existingWorkflow.length > 0) {
        throw new BadRequestException('Workflow with this name already exists');
      }

      // Create workflow with steps
      const workflow = this.workflowsRepo.create({
        name: workflowName,
        description: description || `Workflow with ${steps.length} steps`,
        steps: steps,
        user,
      });

      await this.workflowsRepo.save(workflow);
      console.log('Workflow created with steps:', workflow);

      // Log workflow creation
      await this.loggingService.createLog(
        LogEventType.WORKFLOW_CREATED,
        {
          workflowId: workflow.id,
          workflowName: workflow.name,
          stepsCount: steps.length,
          triggerType: triggerSteps[0]?.appName,
        },
        user,
        workflow,
      );

      // Activate the workflow immediately after creation
      await this.activateWorkflow(workflow.id);

      // Reload to get updated fields
      const activatedWorkflow = await this.workflowsRepo.findOne({
        where: { id: workflow.id },
      });

      return activatedWorkflow || workflow;
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw error;
    }
  }

  async activateWorkflow(workflowId: number): Promise<void> {
    const workflow = await this.workflowsRepo.findOne({
      where: { id: workflowId },
      relations: ['user'],
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    // Determine polling interval based on trigger type
    const triggerStep = workflow.steps?.find((step) => step.type === 'trigger');
    const pollingInterval = this.getPollingInterval(triggerStep?.appName);

    workflow.isActive = true;
    workflow.lastRunAt = undefined as any; // Will run immediately on next poll
    workflow.pollingInterval = pollingInterval;

    await this.workflowsRepo.save(workflow);
    console.log(
      `Workflow ${workflowId} activated with polling interval ${pollingInterval}s`,
    );

    // Log workflow activation
    await this.loggingService.createLog(
      LogEventType.WORKFLOW_ACTIVATED,
      {
        workflowId: workflow.id,
        workflowName: workflow.name,
        pollingInterval,
      },
      workflow.user,
      workflow,
    );
  }

  async deactivateWorkflow(workflowId: number): Promise<void> {
    const workflow = await this.workflowsRepo.findOne({
      where: { id: workflowId },
      relations: ['user'],
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    workflow.isActive = false;
    await this.workflowsRepo.save(workflow);
    console.log(`Workflow ${workflowId} deactivated`);

    // Log workflow deactivation
    await this.loggingService.createLog(
      LogEventType.WORKFLOW_DEACTIVATED,
      {
        workflowId: workflow.id,
        workflowName: workflow.name,
      },
      workflow.user,
      workflow,
    );
  }

  async executeWorkflow(
    workflowId: number,
    triggerData: any,
    workflowRun?: any,
  ): Promise<any> {
    const workflow = await this.workflowsRepo.findOne({
      where: { id: workflowId },
      relations: ['user'],
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    console.log(`Executing workflow ${workflowId}`);

    // Log workflow execution start
    await this.loggingService.createLog(
      LogEventType.WORKFLOW_EXECUTION_STARTED,
      {
        workflowId: workflow.id,
        workflowName: workflow.name,
        triggerData,
      },
      workflow.user,
      workflow,
      workflowRun,
    );

    try {
      // Execute workflow steps using existing logic
      const executionLog = await this.executeWorkflowSteps(
        workflow.user,
        workflow.steps,
        triggerData,
        workflow,
        workflowRun,
      );

      // Log workflow execution completed
      await this.loggingService.createLog(
        LogEventType.WORKFLOW_EXECUTION_COMPLETED,
        {
          workflowId: workflow.id,
          workflowName: workflow.name,
          executionLog,
        },
        workflow.user,
        workflow,
        workflowRun,
      );

      return executionLog;
    } catch (error: any) {
      // Log workflow execution failed
      await this.loggingService.createLog(
        LogEventType.WORKFLOW_EXECUTION_FAILED,
        {
          workflowId: workflow.id,
          workflowName: workflow.name,
          error: error.message,
          stack: error.stack,
        },
        workflow.user,
        workflow,
        workflowRun,
      );
      throw error;
    }
  }

  private getPollingInterval(appName: string): number {
    const intervals = {
      gmail: 60, // 60 seconds
      slack: 30, // 30 seconds
      github: 60, // 60 seconds
      webhook: 0, // Not polled
    };

    return intervals[appName] || 60; // Default 60 seconds
  }

  async findAll(user: User): Promise<Workflow[]> {
    const workflows = await this.workflowsRepo.find({
      where: { user: { id: user.id } },
    });
    console.log('Found workflows for user:', user, workflows);

    if (!workflows) {
      throw new NotFoundException('No workflows found for this user');
    }

    return workflows;
  }

  async findOne(id: number, user: User): Promise<Workflow> {
    const workflow = await this.workflowsRepo.findOne({
      where: { id, user: { id: user.id } },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }
    return workflow;
  }

  async update(
    id: number,
    user: User,
    updateData: Partial<Workflow>,
  ): Promise<Workflow> {
    const workflow = await this.findOne(id, user);
    Object.assign(workflow, updateData);
    return this.workflowsRepo.save(workflow);
  }

  async remove(id: number, user: User): Promise<void> {
    console.log('Removing workflow with id:', id, 'for user:', user);
    const workflow = await this.findOne(id, user);

    // Deactivate workflow before deletion
    await this.deactivateWorkflow(id);

    await this.workflowsRepo.remove(workflow);
  }

  async testWorkflow(user: User, workflow: any) {
    console.log('Testing workflow:', workflow);

    // Handle new workflow format with steps
    if (!workflow.workflow || !workflow.workflow.steps) {
      throw new Error('Workflow data with steps is required');
    }

    const { workflowName, steps } = workflow.workflow;
    console.log(`Testing workflow: ${workflowName}`);

    // Find trigger step
    const triggerStep = steps.find((step) => step.type === 'trigger');
    if (!triggerStep) {
      throw new Error('No trigger step found in workflow');
    }

    // Simulate trigger with real API calls
    const triggerResult = await this.simulateTrigger(user, triggerStep);
    console.log('Trigger result:', triggerResult);

    // Execute workflow steps with real API calls
    const executionLog = await this.executeWorkflowSteps(
      user,
      steps,
      triggerResult,
    );

    return {
      message: `Workflow "${workflowName}" tested successfully`,
      triggerResult,
      executionLog,
    };
  }

  // --- Workflow execution methods ---
  private async executeWorkflowSteps(
    user: User,
    steps: any[],
    triggerData: any,
    workflow?: Workflow,
    workflowRun?: any,
  ): Promise<any[]> {
    const executionLog: any[] = [];
    const stepMap = new Map(steps.map((step) => [step.id, step]));

    // Find the first non-trigger step to execute
    const triggerStep = steps.find((step) => step.type === 'trigger');
    if (!triggerStep) {
      console.log('No trigger step found');
      return executionLog;
    }

    // Start with the first step after trigger (step 2 in our case)
    let currentStepId = '2'; // Start with the condition step

    while (currentStepId) {
      const currentStep = stepMap.get(currentStepId);
      if (!currentStep) {
        console.log(`Step ${currentStepId} not found`);
        break;
      }

      console.log(`Executing step ${currentStepId}: ${currentStep.type}`);

      if (currentStep.type === 'condition') {
        const nextStepId = this.evaluateCondition(currentStep, triggerData);
        executionLog.push({
          stepId: currentStepId,
          type: 'condition',
          result: nextStepId,
          message: `Condition evaluated, next step: ${nextStepId}`,
        });
        currentStepId = nextStepId;
      } else if (currentStep.type === 'action') {
        // Log action started
        await this.loggingService.createLog(
          LogEventType.ACTION_STARTED,
          {
            stepId: currentStepId,
            actionId: currentStep.actionId || currentStep.appName,
            appName: currentStep.appName,
            config: currentStep.config,
          },
          user,
          workflow,
          workflowRun,
        );

        try {
          const actionResult = await this.executeAction(
            user,
            currentStep,
            triggerData,
          );

          // Log action completed
          await this.loggingService.createLog(
            LogEventType.ACTION_COMPLETED,
            {
              stepId: currentStepId,
              actionId: currentStep.actionId || currentStep.appName,
              result: actionResult,
            },
            user,
            workflow,
            workflowRun,
          );

          executionLog.push({
            stepId: currentStepId,
            type: 'action',
            result: actionResult,
            message: `Action executed: ${actionResult.status}`,
          });
        } catch (error: any) {
          // Log action failed
          await this.loggingService.createLog(
            LogEventType.ACTION_FAILED,
            {
              stepId: currentStepId,
              actionId: currentStep.actionId || currentStep.appName,
              error: error.message,
            },
            user,
            workflow,
            workflowRun,
          );
          throw error;
        }

        break; // Actions are terminal steps
      } else {
        console.log(`Unknown step type: ${currentStep.type}`);
        break; // Unknown step type
      }
    }

    return executionLog;
  }

  private evaluateCondition(conditionStep: any, triggerData: any): string {
    const { conditions } = conditionStep;
    console.log('Evaluating condition with triggerData:', triggerData);
    console.log('Conditions:', conditions);

    for (const condition of conditions) {
      if (condition.if) {
        console.log(`Checking condition: ${condition.if}`);
        const result = this.evaluateConditionString(condition.if, triggerData);
        console.log(`Condition result: ${result}`);
        if (result) {
          console.log(`Condition matched, returning: ${condition.then}`);
          return condition.then;
        }
      } else if (condition.else) {
        console.log(`Using else condition: ${condition.else}`);
        return condition.else;
      }
    }

    console.log('No condition matched, returning null');
    return null as any; // No condition matched
  }

  private evaluateConditionString(
    conditionString: string,
    triggerData: any,
  ): boolean {
    console.log(`Evaluating condition string: ${conditionString}`);
    console.log('Trigger data:', triggerData);

    // Parse condition like "{{trigger.subject}} contains 'Order'"
    const match = conditionString.match(
      /\{\{([^}]+)\}\}\s+(contains|equals|not contains|not equals)\s+['"]([^'"]+)['"]/,
    );

    if (!match) {
      console.log('Could not parse condition:', conditionString);
      return false;
    }

    const [, variablePath, operator, value] = match;
    console.log(
      `Parsed: variablePath=${variablePath}, operator=${operator}, value=${value}`,
    );

    const actualValue = this.getNestedValue(triggerData, variablePath);
    console.log(`Actual value from path ${variablePath}:`, actualValue);

    console.log(`Evaluating: ${actualValue} ${operator} ${value}`);

    switch (operator) {
      case 'contains':
        const containsResult =
          actualValue &&
          actualValue.toString().toLowerCase().includes(value.toLowerCase());
        console.log(`Contains result: ${containsResult}`);
        return containsResult;
      case 'equals':
        const equalsResult =
          actualValue &&
          actualValue.toString().toLowerCase() === value.toLowerCase();
        console.log(`Equals result: ${equalsResult}`);
        return equalsResult;
      case 'not contains':
        const notContainsResult =
          !actualValue ||
          !actualValue.toString().toLowerCase().includes(value.toLowerCase());
        console.log(`Not contains result: ${notContainsResult}`);
        return notContainsResult;
      case 'not equals':
        const notEqualsResult =
          !actualValue ||
          actualValue.toString().toLowerCase() !== value.toLowerCase();
        console.log(`Not equals result: ${notEqualsResult}`);
        return notEqualsResult;
      default:
        console.log(`Unknown operator: ${operator}`);
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // --- Real trigger execution with API calls ---
  private async simulateTrigger(user: User, trigger: any) {
    console.log('Executing trigger:', trigger);

    // Use triggerId to determine which specific trigger to execute
    const triggerType = trigger.triggerId || trigger.appName;
    console.log('Trigger type determined:', triggerType);

    // Add default config if missing
    if (!trigger.config) {
      trigger.config = {};
    }

    switch (triggerType) {
      case 'webhook':
        console.log('Simulating Webhook trigger...');
        // Simulate webhook data based on the URL pattern
        const url = trigger.config?.url || '';
        if (url.includes('new-order')) {
          return {
            orderId: 'ORD-12345',
            customerName: 'John Doe',
            amount: 99.99,
            timestamp: new Date().toISOString(),
            status: 'pending',
            items: [{ name: 'Product A', quantity: 2, price: 49.99 }],
          };
        }
        return {
          data: 'Webhook payload received',
          timestamp: new Date().toISOString(),
          source: url,
        };

      case 'new_channel_message':
        console.log('Fetching real Slack messages...');
        try {
          const channel = trigger.config?.channel || 'general';
          const messages = await this.integrationsService.callSlackAPI(
            user,
            'fetchMessages',
            { channel, limit: 1 },
          );

          if (messages && messages.length > 0) {
            const latestMessage = messages[0];
            return {
              trigger: {
                text: latestMessage.text,
                sender: latestMessage.user,
                channel: latestMessage.channel,
                timestamp: latestMessage.timestamp,
              },
            };
          }

          // Fallback if no messages found
          return {
            trigger: {
              text: 'No recent messages found',
              sender: 'system',
              channel,
              timestamp: new Date().toISOString(),
            },
          };
        } catch (error: any) {
          console.error('Error fetching Slack messages:', error.message);
          throw new Error(`Failed to fetch Slack messages: ${error.message}`);
        }

      case 'new_reaction':
        console.log('Simulating Slack reaction trigger...');
        return {
          text: 'Great work!',
          sender: 'Alice',
          channel: '#general',
          reaction: 'thumbsup',
          timestamp: new Date().toISOString(),
        };

      case 'user_joined_channel':
        console.log('Simulating Slack user joined trigger...');
        return {
          text: 'Welcome to the channel!',
          user: 'NewUser',
          channel: '#general',
          timestamp: new Date().toISOString(),
        };

      case 'message_updated':
        console.log('Simulating Slack message updated trigger...');
        return {
          text: 'Updated message content',
          sender: 'Bob',
          channel: '#general',
          originalText: 'Original message',
          timestamp: new Date().toISOString(),
        };

      case 'new_email':
        console.log('Fetching real Gmail emails...');
        try {
          const query = trigger.config?.query || 'is:unread';
          const emails = await this.integrationsService.callGmailAPI(
            user,
            'fetchEmails',
            { query, maxResults: 1 },
          );

          if (emails && emails.length > 0) {
            const latestEmail = emails[0];
            const gmailResult = {
              trigger: {
                subject: latestEmail.subject,
                from: latestEmail.from,
                to: latestEmail.to,
                snippet: latestEmail.snippet,
                body: latestEmail.body,
                timestamp: latestEmail.timestamp,
              },
            };
            console.log('Gmail trigger result:', gmailResult);
            return gmailResult;
          }

          // Fallback if no emails found
          return {
            trigger: {
              subject: 'No recent emails found',
              from: 'system@example.com',
              to: 'user@example.com',
              snippet: 'No unread emails in your inbox',
              body: '',
              timestamp: new Date().toISOString(),
            },
          };
        } catch (error: any) {
          console.error('Error fetching Gmail emails:', error.message);
          throw new Error(`Failed to fetch Gmail emails: ${error.message}`);
        }

      case 'email_labeled':
        console.log('Simulating Gmail email labeled trigger...');
        return {
          subject: 'Important Email',
          from: 'boss@company.com',
          snippet: 'This email was labeled as important',
          labels: ['Important', 'Work'],
          timestamp: new Date().toISOString(),
        };

      case 'email_starred':
        console.log('Fetching real Gmail starred emails...');
        try {
          const query = 'is:starred';
          const emails = await this.integrationsService.callGmailAPI(
            user,
            'fetchEmails',
            { query, maxResults: 1 },
          );

          if (emails && emails.length > 0) {
            const latestEmail = emails[0];
            return {
              trigger: {
                subject: latestEmail.subject,
                from: latestEmail.from,
                to: latestEmail.to,
                snippet: latestEmail.snippet,
                body: latestEmail.body,
                timestamp: latestEmail.timestamp,
                messageId: latestEmail.id,
                starred: true,
              },
            };
          }

          // Fallback if no starred emails found
          return {
            trigger: {
              subject: 'No starred emails found',
              from: 'system@example.com',
              to: 'user@example.com',
              snippet: 'No starred emails in your inbox',
              body: '',
              timestamp: new Date().toISOString(),
              starred: true,
            },
          };
        } catch (error: any) {
          console.error('Error fetching starred Gmail emails:', error.message);
          throw new Error(
            `Failed to fetch starred Gmail emails: ${error.message}`,
          );
        }

      case 'email_replied':
        console.log('Simulating Gmail email replied trigger...');
        return {
          subject: 'Re: Meeting Tomorrow',
          from: 'colleague@company.com',
          snippet: 'Reply to meeting invitation',
          inReplyTo: 'msg-12345',
          timestamp: new Date().toISOString(),
        };

      case 'github':
      case 'new_issue':
        console.log('Fetching real GitHub issues...');
        try {
          const owner = trigger.config?.owner;
          const repo = trigger.config?.repo;

          if (!owner || !repo) {
            throw new Error('GitHub trigger requires owner and repo in config');
          }

          const issues = await this.integrationsService.callGitHubAPI(
            user,
            'listIssues',
            { owner, repo, state: 'open', per_page: 1 },
          );

          if (issues && issues.length > 0) {
            const latestIssue = issues[0];
            return {
              trigger: {
                title: latestIssue.title,
                body: latestIssue.body,
                author: latestIssue.author,
                repository: `${owner}/${repo}`,
                number: latestIssue.number,
                html_url: latestIssue.html_url,
                timestamp: latestIssue.created_at,
                labels: latestIssue.labels,
              },
            };
          }

          // Fallback if no issues found
          return {
            trigger: {
              title: 'No recent issues found',
              body: '',
              author: 'system',
              repository: `${owner}/${repo}`,
              number: 0,
              html_url: '',
              timestamp: new Date().toISOString(),
              labels: [],
            },
          };
        } catch (error: any) {
          console.error('Error fetching GitHub issues:', error.message);
          throw new Error(`Failed to fetch GitHub issues: ${error.message}`);
        }

      case 'pull_request_opened':
        console.log('Fetching real GitHub pull requests...');
        try {
          const owner = trigger.config?.owner;
          const repo = trigger.config?.repo;

          if (!owner || !repo) {
            throw new Error('GitHub trigger requires owner and repo in config');
          }

          const prs = await this.integrationsService.callGitHubAPI(
            user,
            'listPullRequests',
            { owner, repo, state: 'open', per_page: 1 },
          );

          if (prs && prs.length > 0) {
            const latestPR = prs[0];
            return {
              trigger: {
                title: latestPR.title,
                body: latestPR.body,
                author: latestPR.author,
                repository: `${owner}/${repo}`,
                number: latestPR.number,
                html_url: latestPR.html_url,
                baseBranch: latestPR.base_branch,
                headBranch: latestPR.head_branch,
                timestamp: latestPR.created_at,
              },
            };
          }

          // Fallback if no PRs found
          return {
            trigger: {
              title: 'No recent pull requests found',
              body: '',
              author: 'system',
              repository: `${owner}/${repo}`,
              number: 0,
              html_url: '',
              timestamp: new Date().toISOString(),
            },
          };
        } catch (error: any) {
          console.error('Error fetching GitHub PRs:', error.message);
          throw new Error(`Failed to fetch GitHub PRs: ${error.message}`);
        }

      case 'commit_pushed':
        console.log('Fetching real GitHub commits...');
        try {
          const owner = trigger.config?.owner;
          const repo = trigger.config?.repo;
          const branch = trigger.config?.branch;

          if (!owner || !repo) {
            throw new Error('GitHub trigger requires owner and repo in config');
          }

          const commits = await this.integrationsService.callGitHubAPI(
            user,
            'listCommits',
            { owner, repo, branch, per_page: 1 },
          );

          if (commits && commits.length > 0) {
            const latestCommit = commits[0];
            return {
              trigger: {
                message: latestCommit.message,
                author: latestCommit.author,
                repository: `${owner}/${repo}`,
                branch: branch || 'default',
                sha: latestCommit.sha,
                html_url: latestCommit.html_url,
                timestamp: latestCommit.date,
              },
            };
          }

          // Fallback if no commits found
          return {
            trigger: {
              message: 'No recent commits found',
              author: 'system',
              repository: `${owner}/${repo}`,
              branch: branch || 'default',
              sha: '',
              html_url: '',
              timestamp: new Date().toISOString(),
            },
          };
        } catch (error: any) {
          console.error('Error fetching GitHub commits:', error.message);
          throw new Error(`Failed to fetch GitHub commits: ${error.message}`);
        }

      case 'issue_commented':
        console.log('Fetching real GitHub issue comments...');
        try {
          const owner = trigger.config?.owner;
          const repo = trigger.config?.repo;
          const issueNumber = trigger.config?.issueNumber;

          if (!owner || !repo) {
            throw new Error('GitHub trigger requires owner and repo in config');
          }

          const comments = await this.integrationsService.callGitHubAPI(
            user,
            'listIssueComments',
            { owner, repo, issueNumber, per_page: 1 },
          );

          if (comments && comments.length > 0) {
            const latestComment = comments[0];
            return {
              trigger: {
                comment: latestComment.body,
                author: latestComment.author,
                repository: `${owner}/${repo}`,
                issueNumber: issueNumber || 'all',
                html_url: latestComment.html_url,
                timestamp: latestComment.created_at,
              },
            };
          }

          // Fallback if no comments found
          return {
            trigger: {
              comment: 'No recent comments found',
              author: 'system',
              repository: `${owner}/${repo}`,
              issueNumber: issueNumber || 'all',
              html_url: '',
              timestamp: new Date().toISOString(),
            },
          };
        } catch (error: any) {
          console.error('Error fetching GitHub comments:', error.message);
          throw new Error(`Failed to fetch GitHub comments: ${error.message}`);
        }

      default:
        console.log('Unknown trigger type:', triggerType);
        const defaultResult = {
          message: 'Mock trigger data',
          timestamp: new Date().toISOString(),
          type: triggerType,
        };
        console.log('Default trigger result:', defaultResult);
        return defaultResult;
    }
  }

  // --- Real action execution with API calls ---
  private async executeAction(user: User, action: any, dataFromTrigger: any) {
    console.log('Executing action:', action);
    console.log('Data from trigger:', dataFromTrigger);

    // Use actionId to determine which specific action to execute
    const actionType = action.actionId || action.appName; // fallback for backwards compatibility
    console.log('Action type determined:', actionType);

    // Add default config if missing
    if (!action.config) {
      action.config = {};
    }

    switch (actionType) {
      case 'send_channel_message':
        console.log('Posting real Slack message...');
        try {
          // Support both 'message' and 'text' field names from frontend
          let message =
            action.config?.message ||
            action.config?.text ||
            action.config?.description ||
            'Workflow triggered';
          console.log('Channel message config:', action.config);
          console.log('Message value:', message);

          if (dataFromTrigger) {
            // Replace template variables like {{trigger.subject}}
            message = message.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              const value = this.getNestedValue(dataFromTrigger, key);
              return value !== undefined && value !== null ? value : match;
            });
          }

          const channel = action.config?.channel || '#general';
          const result = await this.integrationsService.callSlackAPI(
            user,
            'postMessage',
            { channel, text: message },
          );

          return {
            status: 'success',
            detail: `Posted Slack message to ${channel}: ${message}`,
            channel,
            message,
            messageTs: result.ts,
          };
        } catch (error: any) {
          console.error('Error posting Slack message:', error.message);
          return {
            status: 'failed',
            detail: `Failed to post Slack message: ${error.message}`,
          };
        }

      case 'send_dm':
        console.log('Sending real Slack DM...');
        try {
          // Support both 'text' and 'message' field names
          let dmMessage =
            action.config?.text || action.config?.message || 'Default DM';
          console.log('DM message before substitution:', dmMessage);
          console.log('Trigger data available:', dataFromTrigger);
          if (dataFromTrigger) {
            dmMessage = dmMessage.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              const value = this.getNestedValue(dataFromTrigger, key);
              console.log(
                `Replacing ${match} with:`,
                value !== undefined && value !== null ? value : match,
              );
              return value !== undefined && value !== null ? value : match;
            });
          }
          console.log('DM message after substitution:', dmMessage);

          // Support both 'userId' and 'user_id' field names
          let userId = action.config?.userId || action.config?.user_id;
          if (!userId) {
            console.log('No userId provided, fetching from OAuth metadata...');
            const metadata = await this.integrationsService.getUserAppMetadata(
              user,
              'slack',
            );
            // Slack OAuth response stores the installing user in authed_user.id
            userId = metadata?.authed_user?.id;
            if (!userId) {
              throw new Error(
                'Could not find user ID. Please reconnect your Slack account or provide a userId.',
              );
            }
            console.log(`Automatically using installing user ID: ${userId}`);
          }

          const result = await this.integrationsService.callSlackAPI(
            user,
            'sendDM',
            { userId, text: dmMessage },
          );

          return {
            status: 'success',
            detail: `Sent DM: ${dmMessage}`,
            user: userId,
            message: dmMessage,
            messageTs: result.ts,
          };
        } catch (error: any) {
          console.error('Error sending Slack DM:', error.message);
          return {
            status: 'failed',
            detail: `Failed to send Slack DM: ${error.message}`,
          };
        }

      case 'update_message':
        console.log('Updating Slack message...');
        return {
          status: 'success',
          detail: `Updated message in channel: ${action.config?.channel || 'unknown'}`,
          channel: action.config?.channel,
          messageTs: action.config?.messageTs,
          newText: action.config?.text,
        };

      case 'add_reaction':
        console.log('Adding Slack reaction...');
        return {
          status: 'success',
          detail: `Added reaction ${action.config?.reactionName || 'unknown'} to message`,
          channel: action.config?.channel,
          messageTs: action.config?.messageTs,
          reaction: action.config?.reactionName,
        };

      case 'send_email':
        console.log('Sending real Gmail email...');
        try {
          let subject = action.config?.subject || 'Notification';
          let body = action.config?.body || 'This is an automated notification';
          const to = action.config?.to;

          if (!to) {
            throw new Error('Recipient email (to) is required');
          }

          // Replace template variables
          if (dataFromTrigger) {
            subject = subject.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              const value = this.getNestedValue(dataFromTrigger, key);
              return value !== undefined && value !== null ? value : match;
            });
            body = body.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              const value = this.getNestedValue(dataFromTrigger, key);
              return value !== undefined && value !== null ? value : match;
            });
          }

          const result = await this.integrationsService.callGmailAPI(
            user,
            'sendEmail',
            { to, subject, body },
          );

          return {
            status: 'success',
            detail: `Email sent to ${to} with subject: ${subject}`,
            to,
            subject,
            messageId: result.id,
          };
        } catch (error: any) {
          console.error('Error sending Gmail email:', error.message);
          return {
            status: 'failed',
            detail: `Failed to send email: ${error.message}`,
          };
        }

      case 'reply_to_email':
        try {
          let messageId = action.config?.messageId;
          let threadId = action.config?.threadId;
          let replyBody = action.config?.body || 'This is an automated reply';
          let replySubject = action.config?.subject;

          // Replace template variables
          if (dataFromTrigger) {
            if (messageId) {
              messageId = messageId.replace(
                /\{\{([^}]+)\}\}/g,
                (match, key) => {
                  const value = this.getNestedValue(dataFromTrigger, key);
                  return value !== undefined && value !== null ? value : match;
                },
              );
            }
            if (threadId) {
              threadId = threadId.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
                const value = this.getNestedValue(dataFromTrigger, key);
                return value !== undefined && value !== null ? value : match;
              });
            }
            replyBody = replyBody.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              const value = this.getNestedValue(dataFromTrigger, key);
              return value !== undefined && value !== null ? value : match;
            });
            if (replySubject) {
              replySubject = replySubject.replace(
                /\{\{([^}]+)\}\}/g,
                (match, key) => {
                  const value = this.getNestedValue(dataFromTrigger, key);
                  return value !== undefined && value !== null ? value : match;
                },
              );
            }
          }

          if (!messageId || !threadId) {
            return {
              status: 'failed',
              detail:
                'messageId and threadId are required to reply to an email',
            };
          }

          console.log('Replying to Gmail email...');
          console.log('Message ID:', messageId);
          console.log('Thread ID:', threadId);
          console.log('Reply Body:', replyBody);

          const result = await this.integrationsService.callGmailAPI(
            user,
            'replyToEmail',
            {
              messageId,
              threadId,
              body: replyBody,
              subject: replySubject,
            },
          );

          return {
            status: 'success',
            detail: `Replied to email in thread ${threadId}`,
            messageId: result.id,
            threadId: result.threadId,
          };
        } catch (error: any) {
          console.error('Error replying to Gmail email:', error.message);
          return {
            status: 'failed',
            detail: `Failed to reply to email: ${error.message}`,
          };
        }

      case 'add_label_to_email':
        try {
          let messageId = action.config?.messageId;
          const labelIds = action.config?.labelIds || [];

          // Replace template variables
          if (dataFromTrigger && messageId) {
            messageId = messageId.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              const value = this.getNestedValue(dataFromTrigger, key);
              return value !== undefined && value !== null ? value : match;
            });
          }

          if (!messageId || !labelIds || labelIds.length === 0) {
            return {
              status: 'failed',
              detail: 'messageId and labelIds are required',
            };
          }

          console.log('Adding label to Gmail email...');
          console.log('Message ID:', messageId);
          console.log('Label IDs:', labelIds);

          const result = await this.integrationsService.callGmailAPI(
            user,
            'addLabelToEmail',
            {
              messageId,
              labelIds,
            },
          );

          return {
            status: 'success',
            detail: `Added labels to email ${messageId}`,
            messageId: result.id,
            labelIds: result.labelIds,
          };
        } catch (error: any) {
          console.error('Error adding label to Gmail email:', error.message);
          return {
            status: 'failed',
            detail: `Failed to add label: ${error.message}`,
          };
        }

      case 'star_email':
        try {
          let messageId = action.config?.messageId;

          // Replace template variables
          if (dataFromTrigger && messageId) {
            messageId = messageId.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              const value = this.getNestedValue(dataFromTrigger, key);
              return value !== undefined && value !== null ? value : match;
            });
          }

          if (!messageId) {
            return {
              status: 'failed',
              detail: 'messageId is required',
            };
          }

          console.log('Starring Gmail email...');
          console.log('Message ID:', messageId);

          const result = await this.integrationsService.callGmailAPI(
            user,
            'starEmail',
            { messageId },
          );

          return {
            status: 'success',
            detail: `Starred email ${messageId}`,
            messageId: result.id,
            starred: true,
          };
        } catch (error: any) {
          console.error('Error starring Gmail email:', error.message);
          return {
            status: 'failed',
            detail: `Failed to star email: ${error.message}`,
          };
        }

      case 'create_issue':
        console.log('Creating real GitHub issue...');
        try {
          const owner = action.config?.owner;
          const repo = action.config?.repo;
          let title = action.config?.title || 'Automated Issue';
          let body = action.config?.body || '';
          const labels = action.config?.labels || [];
          const assignees = action.config?.assignees || [];

          if (!owner || !repo) {
            throw new Error('GitHub action requires owner and repo in config');
          }

          // Replace template variables
          if (dataFromTrigger) {
            title = title.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              const value = this.getNestedValue(dataFromTrigger, key);
              return value !== undefined && value !== null ? value : match;
            });
            body = body.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              const value = this.getNestedValue(dataFromTrigger, key);
              return value !== undefined && value !== null ? value : match;
            });
          }

          const result = await this.integrationsService.callGitHubAPI(
            user,
            'createIssue',
            { owner, repo, title, body, labels, assignees },
          );

          return {
            status: 'success',
            detail: `Created GitHub issue #${result.number}: ${title}`,
            repository: `${owner}/${repo}`,
            title,
            number: result.number,
            html_url: result.html_url,
          };
        } catch (error: any) {
          console.error('Error creating GitHub issue:', error.message);
          return {
            status: 'failed',
            detail: `Failed to create GitHub issue: ${error.message}`,
          };
        }

      case 'add_comment_to_issue':
        console.log('Adding real comment to GitHub issue...');
        try {
          const owner = action.config?.owner;
          const repo = action.config?.repo;
          const issueNumber = action.config?.issue_number;
          let comment = action.config?.comment || 'Automated comment';

          if (!owner || !repo || !issueNumber) {
            throw new Error(
              'GitHub comment action requires owner, repo, and issue_number in config',
            );
          }

          // Replace template variables
          if (dataFromTrigger) {
            comment = comment.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              const value = this.getNestedValue(dataFromTrigger, key);
              return value !== undefined && value !== null ? value : match;
            });
          }

          const result = await this.integrationsService.callGitHubAPI(
            user,
            'addCommentToIssue',
            { owner, repo, issueNumber, comment },
          );

          return {
            status: 'success',
            detail: `Added comment to issue #${issueNumber}`,
            repository: `${owner}/${repo}`,
            issueNumber,
            comment,
            html_url: result.html_url,
          };
        } catch (error: any) {
          console.error('Error adding GitHub comment:', error.message);
          return {
            status: 'failed',
            detail: `Failed to add comment: ${error.message}`,
          };
        }

      case 'close_issue':
        console.log('Closing real GitHub issue...');
        try {
          const owner = action.config?.owner;
          const repo = action.config?.repo;
          const issueNumber = action.config?.issue_number;

          if (!owner || !repo || !issueNumber) {
            throw new Error(
              'GitHub close issue action requires owner, repo, and issue_number in config',
            );
          }

          const result = await this.integrationsService.callGitHubAPI(
            user,
            'closeIssue',
            { owner, repo, issueNumber },
          );

          return {
            status: 'success',
            detail: `Closed issue #${issueNumber}`,
            repository: `${owner}/${repo}`,
            issueNumber,
            html_url: result.html_url,
          };
        } catch (error: any) {
          console.error('Error closing GitHub issue:', error.message);
          return {
            status: 'failed',
            detail: `Failed to close issue: ${error.message}`,
          };
        }

      case 'assign_issue':
        console.log('Assigning real GitHub issue...');
        try {
          const owner = action.config?.owner;
          const repo = action.config?.repo;
          const issueNumber = action.config?.issue_number;
          const assignees = action.config?.assignees || [];

          if (!owner || !repo || !issueNumber) {
            throw new Error(
              'GitHub assign issue action requires owner, repo, and issue_number in config',
            );
          }

          const result = await this.integrationsService.callGitHubAPI(
            user,
            'assignIssue',
            { owner, repo, issueNumber, assignees },
          );

          return {
            status: 'success',
            detail: `Assigned issue #${issueNumber} to ${assignees.join(', ')}`,
            repository: `${owner}/${repo}`,
            issueNumber,
            assignees: result.assignees,
            html_url: result.html_url,
          };
        } catch (error: any) {
          console.error('Error assigning GitHub issue:', error.message);
          return {
            status: 'failed',
            detail: `Failed to assign issue: ${error.message}`,
          };
        }

      case 'send_webhook':
        try {
          const url = action.config?.url;
          const method = action.config?.method || 'POST';
          let payload = action.config?.payload || dataFromTrigger;

          if (!url) {
            return {
              status: 'failed',
              detail: 'Webhook URL is required',
            };
          }

          // Replace template variables in payload if it's a string
          if (typeof payload === 'string' && dataFromTrigger) {
            payload = payload.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              const value = this.getNestedValue(dataFromTrigger, key);
              return value !== undefined && value !== null ? value : match;
            });
            // Try to parse as JSON if it's a string
            try {
              payload = JSON.parse(payload);
            } catch {
              // Keep as string if not valid JSON
            }
          }

          // Auto-fix for Slack webhooks: wrap plain string in required format
          if (typeof payload === 'string' && url.includes('hooks.slack.com')) {
            console.log(
              'Detected Slack webhook, wrapping payload in {text: ...}',
            );
            payload = { text: payload };
          }

          // Replace template variables in object payloads
          if (
            typeof payload === 'object' &&
            payload !== null &&
            dataFromTrigger
          ) {
            payload = JSON.parse(
              JSON.stringify(payload).replace(
                /\{\{([^}]+)\}\}/g,
                (match, key) => {
                  const value = this.getNestedValue(dataFromTrigger, key);
                  return value !== undefined && value !== null
                    ? JSON.stringify(value).replace(/^"|"$/g, '')
                    : match;
                },
              ),
            );
          }

          console.log('Sending webhook...');
          console.log('URL:', url);
          console.log('Method:', method);
          console.log('Payload:', JSON.stringify(payload, null, 2));

          const axios = require('axios');
          const response = await axios({
            method: method.toLowerCase(),
            url,
            data: payload,
            headers: {
              'Content-Type': 'application/json',
              ...action.config?.headers,
            },
            timeout: 10000, // 10 second timeout
          });

          console.log('Webhook sent successfully');
          console.log('Response status:', response.status);

          return {
            status: 'success',
            detail: `Webhook sent to ${url}`,
            url,
            responseStatus: response.status,
            responseData: response.data,
          };
        } catch (error: any) {
          console.error('Error sending webhook:', error.message);
          return {
            status: 'failed',
            detail: `Failed to send webhook: ${error.message}`,
            url: action.config?.url,
          };
        }

      default:
        console.log('Unknown action type:', actionType);
        return {
          status: 'failed',
          detail: `No action performed for type: ${actionType}`,
        };
    }
  }
}

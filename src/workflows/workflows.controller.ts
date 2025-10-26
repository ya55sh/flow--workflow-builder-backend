import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import { AppsCatalog } from '../oauth/apps.config';
import { AuthGuard } from '../auth/auth.guard';
import type { Request } from 'express';

@ApiTags('Workflows')
@ApiBearerAuth('JWT-auth')
@Controller('workflows')
@UseGuards(AuthGuard) // Protect all routes
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Create a new workflow',
    description: 'Creates a new workflow with triggers and actions',
  })
  @ApiBody({
    description: 'Workflow configuration',
    examples: {
      'Email to Slack': {
        value: {
          workflow: {
            workflowName: 'Email to Slack Notification',
            steps: [
              {
                id: '1',
                type: 'trigger',
                appName: 'gmail',
                title: 'New Email Received',
                triggerId: 'new_email',
                config: {
                  query: 'is:unread from:boss@company.com',
                },
              },
              {
                id: '2',
                type: 'action',
                appName: 'slack',
                title: 'Send Message',
                actionId: 'send_channel_message',
                config: {
                  channel: '#notifications',
                  message:
                    'New email from {{trigger.from}}: {{trigger.subject}}',
                },
              },
            ],
          },
        },
      },
      'Email Reply': {
        value: {
          workflow: {
            workflowName: 'Auto-Reply to Emails',
            steps: [
              {
                id: '1',
                type: 'trigger',
                appName: 'gmail',
                title: 'New Email',
                triggerId: 'new_email',
                config: {
                  query: 'is:unread',
                },
              },
              {
                id: '2',
                type: 'action',
                appName: 'gmail',
                title: 'Reply',
                actionId: 'reply_to_email',
                config: {
                  messageId: '{{trigger.messageId}}',
                  threadId: '{{trigger.threadId}}',
                  body: 'Thank you for your email. I will respond shortly.',
                },
              },
            ],
          },
        },
      },
      'Webhook Notification': {
        value: {
          workflow: {
            workflowName: 'Send Webhook on Email',
            steps: [
              {
                id: '1',
                type: 'trigger',
                appName: 'gmail',
                title: 'New Email',
                triggerId: 'new_email',
                config: {},
              },
              {
                id: '2',
                type: 'action',
                appName: 'webhook',
                title: 'Send Webhook',
                actionId: 'send_webhook',
                config: {
                  url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
                  method: 'POST',
                  payload: {
                    text: 'New email: {{trigger.subject}}',
                  },
                },
              },
            ],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Workflow created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Email to Slack Notification' },
        description: { type: 'string', example: 'Workflow with 2 steps' },
        isActive: { type: 'boolean', example: false },
        pollingInterval: { type: 'number', example: 60 },
        createdAt: { type: 'string', example: '2025-10-26T10:00:00.000Z' },
        updatedAt: { type: 'string', example: '2025-10-26T10:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid workflow data' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  createWorkflow(@Req() req: Request, @Body() body: any) {
    console.log('Creating workflow with body:', body);

    // Validate new workflow format
    if (!body.workflow || !body.workflow.steps) {
      throw new BadRequestException('Workflow data with steps is required');
    }

    const { workflowName, steps } = body.workflow;

    if (!workflowName) {
      throw new BadRequestException('Workflow name is required');
    }

    if (!steps || steps.length === 0) {
      throw new BadRequestException('At least one step is required');
    }

    // Validate step types
    const triggerSteps = steps.filter((step) => step.type === 'trigger');
    const actionSteps = steps.filter((step) => step.type === 'action');

    if (triggerSteps.length === 0) {
      throw new BadRequestException('At least one trigger step is required');
    }

    if (actionSteps.length === 0) {
      throw new BadRequestException('At least one action step is required');
    }

    return this.workflowsService.create(req.user, body);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all workflows',
    description: 'Returns all workflows for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of workflows returned successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          name: { type: 'string', example: 'Email to Slack' },
          description: { type: 'string', example: 'Workflow with 2 steps' },
          isActive: { type: 'boolean', example: true },
          lastRunAt: { type: 'string', example: '2025-10-26T10:30:00.000Z' },
          pollingInterval: { type: 'number', example: 60 },
          createdAt: { type: 'string', example: '2025-10-25T08:00:00.000Z' },
          updatedAt: { type: 'string', example: '2025-10-26T10:30:00.000Z' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '1' },
                type: { type: 'string', example: 'trigger' },
                appName: { type: 'string', example: 'gmail' },
                title: { type: 'string', example: 'New Email' },
                triggerId: { type: 'string', example: 'new_email' },
                config: { type: 'object' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Req() req: Request) {
    console.log('goiing in plain get all');
    return this.workflowsService.findAll(req.user);
  }

  @Get('apps')
  @ApiOperation({
    summary: 'Get available apps',
    description:
      'Returns list of available apps (Gmail, Slack, GitHub, etc.) with their triggers and actions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available apps with triggers and actions',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '1' },
          appName: { type: 'string', example: 'gmail' },
          displayName: { type: 'string', example: 'Gmail' },
          logo: {
            type: 'string',
            example: 'http://localhost:2000/logos/gmail.png',
          },
          scopes: {
            type: 'array',
            items: { type: 'string' },
            example: ['https://www.googleapis.com/auth/gmail.readonly'],
          },
          triggers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'new_email' },
                title: { type: 'string', example: 'New Email Received' },
                description: {
                  type: 'string',
                  example: 'Trigger when a new email arrives',
                },
                scopes: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'send_email' },
                title: { type: 'string', example: 'Send Email' },
                description: {
                  type: 'string',
                  example: 'Send an email from your account',
                },
                scopes: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  })
  getUserWorkflowApps() {
    return Object.entries(AppsCatalog).map(([appName, config]) => ({
      id: config.id,
      appName,
      displayName: config.displayName,
      logo: config.logo,
      scopes: config.scopes,
      triggerScopes: config.triggerScopes,
      actionScopes: config.actionScopes,
      triggers: config.triggers,
      actions: config.actions,
    }));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get workflow by ID',
    description: 'Returns a specific workflow by ID',
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Workflow found',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Email to Slack' },
        description: { type: 'string', example: 'Workflow with 2 steps' },
        isActive: { type: 'boolean', example: true },
        lastRunAt: { type: 'string', example: '2025-10-26T10:30:00.000Z' },
        pollingInterval: { type: 'number', example: 60 },
        createdAt: { type: 'string', example: '2025-10-25T08:00:00.000Z' },
        updatedAt: { type: 'string', example: '2025-10-26T10:30:00.000Z' },
        steps: {
          type: 'array',
          description: 'Complete workflow steps array',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this workflow',
  })
  findOneWorkflow(@Req() req: Request, @Param('id') id: string) {
    console.log('goiing in plain get by id');
    return this.workflowsService.findOne(+id, req.user);
  }

  @Patch(':id')
  updateWorkflow(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.workflowsService.update(+id, req.user, body);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete workflow',
    description: 'Deletes a workflow by ID',
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Workflow deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Workflow deleted successfully' },
        workflowId: { type: 'number', example: 1 },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  removeWorkflow(@Req() req: Request, @Param('id') id: string) {
    console.log('Deleting workflow with id:', id);
    return this.workflowsService.remove(+id, req.user);
  }

  @Patch(':id/toggle')
  @ApiOperation({
    summary: 'Activate/Deactivate workflow',
    description: 'Toggle workflow activation status',
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', example: 1 })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['isActive'],
      properties: {
        isActive: {
          type: 'boolean',
          example: true,
          description: 'true to activate, false to deactivate',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Workflow status toggled successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Workflow activated' },
        workflowId: { type: 'number', example: 1 },
        isActive: { type: 'boolean', example: true },
      },
    },
  })
  async toggleWorkflow(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    const workflow = await this.workflowsService.findOne(+id, req.user);

    if (body.isActive) {
      await this.workflowsService.activateWorkflow(+id);
    } else {
      await this.workflowsService.deactivateWorkflow(+id);
    }

    return {
      message: `Workflow ${body.isActive ? 'activated' : 'deactivated'}`,
      workflowId: +id,
      isActive: body.isActive,
    };
  }

  @Post('test')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Test workflow',
    description: 'Test a workflow without saving it (simulation mode)',
  })
  @ApiBody({
    description: 'Workflow configuration to test',
    examples: {
      'Test Email to Slack': {
        value: {
          workflow: {
            workflowName: 'Test Workflow',
            steps: [
              {
                id: '1',
                type: 'trigger',
                appName: 'gmail',
                triggerId: 'new_email',
                config: {},
              },
              {
                id: '2',
                type: 'action',
                appName: 'slack',
                actionId: 'send_channel_message',
                config: {
                  channel: '#test',
                  message: 'Test message',
                },
              },
            ],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Workflow test executed successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        executionTime: { type: 'number', example: 1245 },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepId: { type: 'string', example: '2' },
              status: { type: 'string', example: 'success' },
              detail: {
                type: 'string',
                example: 'Posted Slack message to #test',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid workflow configuration' })
  async testWorkflow(@Req() req: Request, @Body() body: Record<string, any>) {
    console.log('Test workflow request:', body);
    console.log('User:', req.user);

    // Validate new workflow format
    if (!body.workflow || !body.workflow.steps) {
      throw new BadRequestException('Workflow data with steps is required');
    }

    const result = await this.workflowsService.testWorkflow(req.user, body);

    return result;
  }
}

import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LoggingService } from './logging.service';
import { AuthGuard } from '../auth/auth.guard';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from './db.workflow';
import { WorkflowRun } from './db.workflow_run';

@ApiTags('Logs')
@ApiBearerAuth('JWT-auth')
@Controller('logs')
@UseGuards(AuthGuard)
export class LogsController {
  constructor(
    private readonly loggingService: LoggingService,
    @InjectRepository(Workflow)
    private readonly workflowRepo: Repository<Workflow>,
    @InjectRepository(WorkflowRun)
    private readonly workflowRunRepo: Repository<WorkflowRun>,
  ) {}

  @Get('workflow/:workflowId')
  @ApiOperation({
    summary: 'Get logs for a specific workflow',
    description:
      'Retrieves all execution logs for a specific workflow. Supports filtering by event type and limiting the number of results. Only returns logs for workflows owned by the authenticated user.',
  })
  @ApiParam({
    name: 'workflowId',
    description: 'The ID of the workflow to retrieve logs for',
    example: 123,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of logs to return (default: 100, max: 500)',
    required: false,
    example: 50,
    type: Number,
  })
  @ApiQuery({
    name: 'eventType',
    description:
      'Filter logs by event type (e.g., workflow_execution_started, action_completed, workflow_execution_failed, token_refreshed)',
    required: false,
    example: 'workflow_execution_started',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Workflow logs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        workflowId: { type: 'number', example: 123 },
        workflowName: { type: 'string', example: 'Gmail to Slack Notifier' },
        totalLogs: { type: 'number', example: 15 },
        logs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 456 },
              eventType: {
                type: 'string',
                example: 'workflow_execution_started',
              },
              details: {
                type: 'object',
                example: {
                  workflowId: 123,
                  workflowName: 'Gmail to Slack Notifier',
                },
              },
              workflowRun: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'number', example: 789 },
                },
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
                example: '2024-01-15T10:30:00.000Z',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid workflow ID',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Invalid workflow ID' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have access to this workflow',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'You do not have access to this workflow logs',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Workflow not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Workflow not found' },
      },
    },
  })
  async getWorkflowLogs(
    @Req() req: Request,
    @Param('workflowId') workflowId: string,
    @Query('limit') limit?: string,
    @Query('eventType') eventType?: string,
  ) {
    const workflowIdNum = parseInt(workflowId, 10);
    if (isNaN(workflowIdNum)) {
      throw new BadRequestException('Invalid workflow ID');
    }

    // Validate user owns the workflow
    await this.validateWorkflowAccess(req.user.id, workflowIdNum);

    // Parse and validate limit
    let limitNum = limit ? parseInt(limit, 10) : 100;
    if (isNaN(limitNum) || limitNum < 1) {
      limitNum = 100;
    }
    if (limitNum > 500) {
      limitNum = 500; // Max limit
    }

    // Get logs with optional filters
    const logs = await this.loggingService.getLogsForWorkflowWithFilters(
      workflowIdNum,
      limitNum,
      eventType,
    );

    // Get workflow details
    const workflow = await this.workflowRepo.findOne({
      where: { id: workflowIdNum },
      select: ['id', 'name'],
    });

    return {
      workflowId: workflowIdNum,
      workflowName: workflow?.name || 'Unknown',
      totalLogs: logs.length,
      logs: logs.map((log) => ({
        id: log.id,
        eventType: log.eventType,
        details: log.details,
        workflowRun: log.workflowRun ? { id: log.workflowRun.id } : null,
        createdAt: log.createdAt,
      })),
    };
  }

  @Get('workflow-run/:workflowRunId')
  @ApiOperation({
    summary: 'Get logs for a specific workflow run',
    description:
      'Retrieves all execution logs for a specific workflow run instance. Returns detailed run information including status, timestamps, and a chronological list of events that occurred during execution. Only returns logs for workflow runs owned by the authenticated user.',
  })
  @ApiParam({
    name: 'workflowRunId',
    description: 'The ID of the workflow run to retrieve logs for',
    example: 789,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Workflow run logs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        workflowRunId: { type: 'number', example: 789 },
        workflow: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 123 },
            name: { type: 'string', example: 'Gmail to Slack Notifier' },
          },
        },
        status: {
          type: 'string',
          enum: ['running', 'completed', 'failed'],
          example: 'completed',
        },
        startedAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-15T10:30:00.000Z',
        },
        finishedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          example: '2024-01-15T10:30:45.000Z',
        },
        logs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 456 },
              eventType: {
                type: 'string',
                example: 'workflow_execution_started',
              },
              details: {
                type: 'object',
                example: {
                  workflowId: 123,
                  workflowName: 'Gmail to Slack Notifier',
                  triggerData: {
                    from: 'user@example.com',
                    subject: 'Test Email',
                  },
                },
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
                example: '2024-01-15T10:30:00.000Z',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid workflow run ID',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Invalid workflow run ID' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have access to this workflow run',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'You do not have access to this workflow run logs',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Workflow run not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Workflow run not found' },
      },
    },
  })
  async getWorkflowRunLogs(
    @Req() req: Request,
    @Param('workflowRunId') workflowRunId: string,
  ) {
    const workflowRunIdNum = parseInt(workflowRunId, 10);
    if (isNaN(workflowRunIdNum)) {
      throw new BadRequestException('Invalid workflow run ID');
    }

    // Validate user owns the workflow run
    const workflowRun = await this.validateWorkflowRunAccess(
      req.user.id,
      workflowRunIdNum,
    );

    // Get logs for this specific run (chronological order)
    const logs =
      await this.loggingService.getLogsForWorkflowRun(workflowRunIdNum);

    return {
      workflowRunId: workflowRunIdNum,
      workflow: {
        id: workflowRun.workflow.id,
        name: workflowRun.workflow.name,
      },
      status: workflowRun.status,
      startedAt: workflowRun.startedAt,
      finishedAt: workflowRun.finishedAt,
      logs: logs.map((log) => ({
        id: log.id,
        eventType: log.eventType,
        details: log.details,
        createdAt: log.createdAt,
      })),
    };
  }

  /**
   * Validate that the user owns the workflow
   */
  private async validateWorkflowAccess(
    userId: number,
    workflowId: number,
  ): Promise<void> {
    const workflow = await this.workflowRepo.findOne({
      where: { id: workflowId },
      relations: ['user'],
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (workflow.user.id !== userId) {
      throw new ForbiddenException(
        'You do not have access to this workflow logs',
      );
    }
  }

  /**
   * Validate that the user owns the workflow run
   */
  private async validateWorkflowRunAccess(
    userId: number,
    workflowRunId: number,
  ): Promise<WorkflowRun> {
    const workflowRun = await this.workflowRunRepo.findOne({
      where: { id: workflowRunId },
      relations: ['workflow', 'workflow.user'],
    });

    if (!workflowRun) {
      throw new NotFoundException('Workflow run not found');
    }

    if (workflowRun.workflow.user.id !== userId) {
      throw new ForbiddenException(
        'You do not have access to this workflow run logs',
      );
    }

    return workflowRun;
  }
}

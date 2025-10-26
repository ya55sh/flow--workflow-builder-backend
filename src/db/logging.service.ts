import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Log } from './db.log';
import { User } from './db.user';
import { Workflow } from './db.workflow';
import { WorkflowRun } from './db.workflow_run';

/**
 * Event types that can be logged during workflow execution
 */
export enum LogEventType {
  WORKFLOW_CREATED = 'workflow_created',
  WORKFLOW_ACTIVATED = 'workflow_activated',
  WORKFLOW_DEACTIVATED = 'workflow_deactivated',
  WORKFLOW_EXECUTION_STARTED = 'workflow_execution_started',
  WORKFLOW_EXECUTION_COMPLETED = 'workflow_execution_completed',
  WORKFLOW_EXECUTION_FAILED = 'workflow_execution_failed',
  TRIGGER_CHECKED = 'trigger_checked',
  TRIGGER_FIRED = 'trigger_fired',
  ACTION_STARTED = 'action_started',
  ACTION_COMPLETED = 'action_completed',
  ACTION_FAILED = 'action_failed',
  TOKEN_REFRESHED = 'token_refreshed',
}

/**
 * Logging Service
 *
 * Centralized service for creating and managing workflow execution logs.
 * Provides methods to:
 * - Create log entries for workflow events
 * - Query logs by workflow or workflow run
 * - Clean up old log entries
 */
@Injectable()
export class LoggingService {
  constructor(
    @InjectRepository(Log)
    private readonly logRepo: Repository<Log>,
  ) {}

  /**
   * Create a log entry for a workflow event
   * @param eventType The type of event being logged
   * @param details Additional details about the event
   * @param user The user associated with the event (optional)
   * @param workflow The workflow associated with the event (optional)
   * @param workflowRun The workflow run associated with the event (optional)
   * @returns The created log entry
   */
  async createLog(
    eventType: LogEventType | string,
    details?: any,
    user?: User,
    workflow?: Workflow,
    workflowRun?: WorkflowRun,
  ): Promise<Log> {
    try {
      const log = this.logRepo.create({
        eventType,
        details: details || {},
        user: user || (null as any),
        workflow: workflow || (null as any),
        workflowRun: workflowRun || (null as any),
      });

      const savedLog = await this.logRepo.save(log);
      console.log(`Log created: ${eventType} (ID: ${savedLog.id})`);
      return savedLog;
    } catch (error: any) {
      // Log to console if database logging fails to avoid circular errors
      console.error('Failed to create log entry:', error.message);
      throw error;
    }
  }

  /**
   * Clean up logs older than specified days (default 30 days)
   */
  async cleanupOldLogs(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.logRepo.delete({
        createdAt: LessThan(cutoffDate),
      });

      const deletedCount = result.affected || 0;
      console.log(
        `Cleaned up ${deletedCount} log entries older than ${daysOld} days`,
      );

      return deletedCount;
    } catch (error: any) {
      console.error('Error cleaning up old logs:', error.message);
      throw error;
    }
  }

  /**
   * Get logs for a specific workflow run
   */
  async getLogsForWorkflowRun(workflowRunId: number): Promise<Log[]> {
    return this.logRepo.find({
      where: { workflowRun: { id: workflowRunId } },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get logs for a specific workflow
   */
  async getLogsForWorkflow(
    workflowId: number,
    limit: number = 100,
  ): Promise<Log[]> {
    return this.logRepo.find({
      where: { workflow: { id: workflowId } },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get logs for a specific workflow with optional filters
   */
  async getLogsForWorkflowWithFilters(
    workflowId: number,
    limit: number = 100,
    eventType?: string,
  ): Promise<Log[]> {
    const queryBuilder = this.logRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.workflowRun', 'workflowRun')
      .where('log.workflowId = :workflowId', { workflowId })
      .orderBy('log.createdAt', 'DESC')
      .take(limit);

    // Add eventType filter if provided
    if (eventType) {
      queryBuilder.andWhere('log.eventType = :eventType', { eventType });
    }

    return queryBuilder.getMany();
  }

  /**
   * Get logs for a specific user
   */
  async getLogsForUser(userId: number, limit: number = 100): Promise<Log[]> {
    return this.logRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

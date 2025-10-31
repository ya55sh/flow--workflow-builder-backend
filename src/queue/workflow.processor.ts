import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowRun } from '../db/db.workflow_run';
import { Workflow } from '../db/db.workflow';
import { User } from '../db/db.user';
import { ProcessedTrigger } from '../db/db.processed_trigger';
import { WorkflowsService } from '../workflows/workflows.service';
import { LoggingService, LogEventType } from '../db/logging.service';
import Redis from 'ioredis';

@Injectable()
export class WorkflowProcessor {
  private worker: Worker;
  private connection: Redis;

  constructor(
    @InjectRepository(WorkflowRun)
    private workflowRunRepo: Repository<WorkflowRun>,
    @InjectRepository(Workflow)
    private workflowRepo: Repository<Workflow>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(ProcessedTrigger)
    private processedTriggerRepo: Repository<ProcessedTrigger>,
    @Inject(forwardRef(() => WorkflowsService))
    private workflowsService: WorkflowsService,
    private loggingService: LoggingService,
  ) {
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      username: process.env.REDIS_USERNAME || 'default',
      password: process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: null,
      tls: {},
    });

    this.worker = new Worker(
      'workflow-execution',
      async (job: Job) => {
        return await this.processWorkflow(job);
      },
      {
        connection: this.connection,
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err.message);
    });
  }

  private async processWorkflow(job: Job): Promise<any> {
    const { workflowId, userId, triggerData } = job.data;
    const attemptNumber = job.attemptsMade;

    console.log(
      `Processing workflow ${workflowId} (attempt ${attemptNumber + 1}/3)`,
    );
    console.log(
      `Trigger: ${triggerData.data?.trigger?.subject || triggerData.data?.trigger?.text || triggerData.data?.trigger?.title || triggerData.triggerId || 'Unknown'}`,
    );

    // Create or update WorkflowRun record
    const workflow = await this.workflowRepo.findOne({
      where: { id: workflowId },
      relations: ['user'],
    });

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Create workflow run record
    let workflowRun = this.workflowRunRepo.create({
      workflow,
      status: 'running',
      triggerData,
      retryCount: attemptNumber,
      startedAt: new Date(),
    });
    workflowRun = await this.workflowRunRepo.save(workflowRun);

    // Log workflow execution started in processor
    await this.loggingService.createLog(
      LogEventType.WORKFLOW_EXECUTION_STARTED,
      {
        workflowId: workflow.id,
        workflowName: workflow.name,
        workflowRunId: workflowRun.id,
        attempt: attemptNumber + 1,
      },
      user,
      workflow,
      workflowRun,
    );

    try {
      // Execute the workflow using WorkflowsService
      // Unwrap data if it's wrapped by the scheduler
      const unwrappedTriggerData = triggerData.data || triggerData;
      const executionResult = await this.workflowsService.executeWorkflow(
        workflowId,
        unwrappedTriggerData,
        workflowRun,
      );

      // Update workflow run with success
      workflowRun.status = 'success';
      workflowRun.finishedAt = new Date();
      workflowRun.executionLog = executionResult;
      await this.workflowRunRepo.save(workflowRun);

      // Log workflow execution completed in processor
      await this.loggingService.createLog(
        LogEventType.WORKFLOW_EXECUTION_COMPLETED,
        {
          workflowId: workflow.id,
          workflowName: workflow.name,
          workflowRunId: workflowRun.id,
          executionTime: new Date().getTime() - workflowRun.startedAt.getTime(),
        },
        user,
        workflow,
        workflowRun,
      );

      // Update workflow lastRunAt
      workflow.lastRunAt = new Date();
      await this.workflowRepo.save(workflow);

      // Record processed trigger to prevent duplicate executions
      if (triggerData && triggerData.externalId && triggerData.triggerId) {
        try {
          await this.processedTriggerRepo.save({
            workflow: { id: workflowId },
            triggerType: triggerData.triggerId,
            externalId: triggerData.externalId,
            metadata: triggerData.data || {},
          });
          console.log(
            `Recorded processed trigger: ${triggerData.triggerId}/${triggerData.externalId}`,
          );
        } catch (error: any) {
          // Ignore duplicate key errors (race condition)
          if (!error.message.includes('duplicate key')) {
            console.error('Error recording processed trigger:', error.message);
          }
        }
      }

      return { status: 'success', workflowRunId: workflowRun.id };
    } catch (error: any) {
      console.error(`Workflow execution failed:`, error.message);

      workflowRun.status = 'failed';
      workflowRun.error = error.message;
      workflowRun.finishedAt = new Date();
      workflowRun.retryCount = attemptNumber + 1;
      await this.workflowRunRepo.save(workflowRun);

      // Log workflow execution failed in processor
      await this.loggingService.createLog(
        LogEventType.WORKFLOW_EXECUTION_FAILED,
        {
          workflowId: workflow.id,
          workflowName: workflow.name,
          workflowRunId: workflowRun.id,
          error: error.message,
          stack: error.stack,
          attempt: attemptNumber + 1,
        },
        user,
        workflow,
        workflowRun,
      );

      throw error; // Re-throw to trigger BullMQ retry
    }
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.connection.quit();
  }
}

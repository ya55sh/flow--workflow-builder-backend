import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class QueueService {
  private workflowQueue: Queue;
  private connection: Redis;

  constructor() {
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      username: process.env.REDIS_USERNAME || 'default',
      password: process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: null,
    });

    this.workflowQueue = new Queue('workflow-execution', {
      connection: this.connection,
    });
  }

  async addWorkflowJob(
    workflowId: number,
    userId: number,
    triggerData: any,
  ): Promise<void> {
    await this.workflowQueue.add(
      'execute-workflow',
      {
        workflowId,
        userId,
        triggerData,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // 1s, 2s, 4s
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    console.log(
      `Added workflow job to queue: workflowId=${workflowId}, userId=${userId}`,
    );
  }

  async removeWorkflowJobs(workflowId: number): Promise<void> {
    const jobs = await this.workflowQueue.getJobs([
      'waiting',
      'active',
      'delayed',
    ]);
    const jobsToRemove = jobs.filter(
      (job) => job.data.workflowId === workflowId,
    );

    for (const job of jobsToRemove) {
      await job.remove();
    }

    console.log(
      `Removed ${jobsToRemove.length} pending jobs for workflow ${workflowId}`,
    );
  }

  async getJobCounts(): Promise<any> {
    return await this.workflowQueue.getJobCounts();
  }

  getQueue(): Queue {
    return this.workflowQueue;
  }

  async onModuleDestroy() {
    await this.workflowQueue.close();
    await this.connection.quit();
  }
}

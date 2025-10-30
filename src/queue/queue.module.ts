import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueService } from './queue.service';
import { WorkflowProcessor } from './workflow.processor';
import { SchedulerService } from './scheduler.service';
import { Workflow } from '../db/db.workflow';
import { WorkflowRun } from '../db/db.workflow_run';
import { User } from '../db/db.user';
import { ProcessedTrigger } from '../db/db.processed_trigger';
import { WorkflowsModule } from '../workflows/workflows.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { DbModule } from '../db/db.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow, WorkflowRun, User, ProcessedTrigger]),
    forwardRef(() => WorkflowsModule),
    IntegrationsModule,
    DbModule,
  ],
  providers: [QueueService, WorkflowProcessor, SchedulerService],
  exports: [QueueService, SchedulerService],
})
export class QueueModule {}

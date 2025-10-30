import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Log } from './db.log';
import { Workflow } from './db.workflow';
import { WorkflowRun } from './db.workflow_run';
import { LoggingService } from './logging.service';
import { LogsController } from './logs.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Log, Workflow, WorkflowRun]), AuthModule],
  controllers: [LogsController],
  providers: [LoggingService],
  exports: [LoggingService],
})
export class DbModule {}

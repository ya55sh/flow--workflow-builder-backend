import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { AuthModule } from 'src/auth/auth.module';
import { Action } from 'src/db/db.action';
import { Trigger } from 'src/db/db.trigger';
import { Workflow } from '../db/db.workflow';

@Module({
  imports: [TypeOrmModule.forFeature([Workflow, Action, Trigger]), AuthModule],
  providers: [WorkflowsService],
  controllers: [WorkflowsController],
})
export class WorkflowsModule {}

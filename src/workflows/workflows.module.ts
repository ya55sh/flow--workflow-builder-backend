import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { AuthModule } from 'src/auth/auth.module';
import { Workflow } from '../db/db.workflow';
import { IntegrationsModule } from '../integrations/integrations.module';
import { DbModule } from '../db/db.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow]),
    AuthModule,
    IntegrationsModule,
    DbModule,
  ],
  providers: [WorkflowsService],
  controllers: [WorkflowsController],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}

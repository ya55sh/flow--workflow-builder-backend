import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { OauthModule } from './oauth/oauth.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { QueueModule } from './queue/queue.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './db/db.user';
import { Workflow } from './db/db.workflow';
import { WorkflowRun } from './db/db.workflow_run';
import { UserApp } from './db/db.user_app';
import { Log } from './db/db.log';
import { ProcessedTrigger } from './db/db.processed_trigger';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'flow_db',
      entities: [User, Workflow, WorkflowRun, Log, UserApp, ProcessedTrigger],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    AuthModule,
    UsersModule,
    WorkflowsModule,
    OauthModule,
    IntegrationsModule,
    QueueModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

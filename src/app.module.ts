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
      url:
        process.env.DATABASE_URL ||
        'postgres://postgres:root@localhost:5432/flow_db',
      entities: [User, Workflow, WorkflowRun, Log, UserApp, ProcessedTrigger],
      synchronize: process.env.NODE_ENV !== 'production',
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
      extra: {
        max: 5, // Connection pool size
      },
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

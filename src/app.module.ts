import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './db/db.user';
import { Workflow } from './db/db.workflow';
import { Action } from './db/db.action';
import { Trigger } from './db/db.trigger';
import { WorkflowRun } from './db/db.workflow_run';
import { ActionRun } from './db/db.action-run';
import { Log } from './db/db.log';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'root',
      database: 'flow_db',
      entities: [User, Workflow, Action, Trigger, WorkflowRun, ActionRun, Log],
      synchronize: true,
    }),
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

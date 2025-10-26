import { DataSource } from 'typeorm';
import { User } from './db/db.user';
import { Workflow } from './db/db.workflow';
import { WorkflowRun } from './db/db.workflow_run';
import { UserApp } from './db/db.user_app';
import { Log } from './db/db.log';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'root',
  database: 'flow_db',
  entities: [User, Workflow, WorkflowRun, Log, UserApp],
  migrations: ['src/migrations/*.ts'],
  synchronize: false, // Disable in production, use migrations instead
  logging: true,
});

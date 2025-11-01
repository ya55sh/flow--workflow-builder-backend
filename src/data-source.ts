import { DataSource } from 'typeorm';
import { config as dotenvConfig } from 'dotenv';
import { User } from './db/db.user';
import { Workflow } from './db/db.workflow';
import { WorkflowRun } from './db/db.workflow_run';
import { UserApp } from './db/db.user_app';
import { Log } from './db/db.log';

// Load environment variables
dotenvConfig();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'flow_db',
  entities: [User, Workflow, WorkflowRun, Log, UserApp],
  migrations: ['src/migrations/*.ts'],
  synchronize: true, // Disable in production, use migrations instead
  logging: process.env.NODE_ENV !== 'production',
});

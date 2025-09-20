import { DataSource } from 'typeorm';
import { User } from './db.user';
import { Workflow } from './db.workflow';
import { Action } from './db.action';
import { Trigger } from './db.trigger';
import { WorkflowRun } from './db.workflow_run';
import { ActionRun } from './db.action-run';
import { Log } from './db.log';

export const databaseProviders = [
  {
    provide: 'DATA_SOURCE',
    useFactory: async () => {
      const dataSource = new DataSource({
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: 'root',
        database: 'flow_db',
        entities: [
          User,
          Workflow,
          Action,
          Trigger,
          WorkflowRun,
          ActionRun,
          Log,
        ],
        synchronize: true,
      });

      return dataSource.initialize();
    },
  },
];

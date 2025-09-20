import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from './db.user';
import { Workflow } from './db.workflow';
import { WorkflowRun } from './db.workflow_run';

@Entity()
export class Log {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  user: User;

  @ManyToOne(() => Workflow, { nullable: true, onDelete: 'SET NULL' })
  workflow: Workflow;

  @ManyToOne(() => WorkflowRun, { nullable: true, onDelete: 'SET NULL' })
  workflowRun: WorkflowRun;

  @Column()
  eventType: string; // e.g. "workflow_created", "action_failed"

  @Column({ type: 'json', nullable: true })
  details: any; // store extra info (error message, payload, etc.)

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

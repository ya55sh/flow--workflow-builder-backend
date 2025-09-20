import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Workflow } from './db.workflow';
import { ActionRun } from './db.action-run';

@Entity()
export class WorkflowRun {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
  workflow: Workflow;

  @Column()
  status: string; // "running", "success", "failed"

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date;

  @OneToMany(() => ActionRun, (actionRun) => actionRun.workflowRun)
  actionRuns: ActionRun[];
}

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { WorkflowRun } from './db.workflow_run';
import { Action } from './db.action';

@Entity()
export class ActionRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  status: string; // "pending", "success", "failed"

  @Column({ type: 'json', nullable: true })
  inputData: any;

  @Column({ type: 'json', nullable: true })
  outputData: any;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date;

  @ManyToOne(() => WorkflowRun, (workflowRun) => workflowRun.actionRuns, {
    onDelete: 'CASCADE',
  })
  workflowRun: WorkflowRun;

  @ManyToOne(() => Action, { onDelete: 'CASCADE' })
  action: Action;
}

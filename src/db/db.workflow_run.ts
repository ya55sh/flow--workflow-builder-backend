import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Workflow } from './db.workflow';

@Entity()
export class WorkflowRun {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
  workflow: Workflow;

  @Column()
  status: string; // "running", "success", "failed"

  @Column({ type: 'json', nullable: true })
  triggerData: any; // Data that triggered the workflow

  @Column({ type: 'json', nullable: true })
  executionLog: any; // Step-by-step execution results

  @Column({ default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  error: string; // Error message if failed

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date;
}

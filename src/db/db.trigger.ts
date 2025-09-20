import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Workflow } from './db.workflow';

@Entity()
export class Trigger {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: string; // e.g. "email_received", "webhook"

  @Column({ type: 'json' })
  config: any; // trigger-specific settings

  @ManyToOne(() => Workflow, (workflow) => workflow.triggers, {
    onDelete: 'CASCADE',
  })
  workflow: Workflow;
}

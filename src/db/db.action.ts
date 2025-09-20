import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Workflow } from './db.workflow';

@Entity()
export class Action {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: string; // e.g. "send_email", "post_slack"

  @Column({ type: 'json' })
  config: any; // action-specific settings

  @Column()
  orderNo: number; // sequence in the workflow

  @ManyToOne(() => Workflow, (workflow) => workflow.actions, {
    onDelete: 'CASCADE',
  })
  workflow: Workflow;
}

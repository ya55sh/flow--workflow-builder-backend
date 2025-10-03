import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Workflow } from './db.workflow';

@Entity()
export class Trigger {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: string; // e.g. "email_received", "webhook"

  @Column({ type: 'json' })
  config: any; // trigger-specific settings

  @OneToOne(() => Workflow, (workflow) => workflow.trigger, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  workflow: Workflow;
}

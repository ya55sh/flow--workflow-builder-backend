import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { Workflow } from './db.workflow';

@Entity()
@Index(['workflow', 'triggerType', 'externalId'], { unique: true })
export class ProcessedTrigger {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
  workflow: Workflow;

  @Column()
  triggerType: string; // 'new_email', 'new_channel_message', 'new_issue', etc.

  @Column()
  externalId: string; // Email message ID, Slack message TS, GitHub issue number, etc.

  @Column({ type: 'json', nullable: true })
  metadata: any; // Store additional identifying info

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  processedAt: Date;
}

import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from './db.user';

@Entity()
export class Workflow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  steps: any; // Store the entire workflow steps array from FE

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastRunAt: Date;

  @Column({ nullable: true })
  pollingInterval: number; // seconds, derived from trigger type

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.workflows, { onDelete: 'CASCADE' })
  user: User;
}

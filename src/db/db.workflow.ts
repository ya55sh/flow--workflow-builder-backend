import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { User } from './db.user';
import { Trigger } from './db.trigger';
import { Action } from './db.action';

@Entity()
export class Workflow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

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

  @OneToMany(() => Action, (action) => action.workflow)
  actions: Action[];

  @OneToOne(() => Trigger, (trigger) => trigger.workflow)
  trigger: Trigger;
}

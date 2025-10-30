import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Workflow } from './db.workflow';
import { UserApp } from './db.user_app';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false, unique: true })
  email: string;

  @Column({ nullable: true, select: false })
  password: string;

  @Column()
  provider: string; // e.g. "local", "google", "github"

  @Column({ nullable: true })
  providerId: string; // ID from the OAuth provider

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @OneToMany(() => Workflow, (workflow) => workflow.user)
  workflows: Workflow[];

  @OneToMany(() => UserApp, (userApp) => userApp.user)
  apps: UserApp[];
}

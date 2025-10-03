import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from './db.user';

@Entity()
export class UserApp {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.apps, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  appName: string; // e.g., "slack", "google"

  @Column()
  accessToken: string;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date; // access token expiry

  @Column({ type: 'json', nullable: true })
  metadata: any; // store extra info like Slack userId, workspace info, etc.
}

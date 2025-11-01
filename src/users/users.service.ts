import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../db/db.user';
import { UserApp } from 'src/db/db.user_app';
import { Workflow } from 'src/db/db.workflow';
import * as bcrypt from 'bcrypt';

type NormalAuthPayload = {
  type: 'normal';
  email: string;
  password: string;
  confirmPassword: string;
};

type GoogleAuthPayload = {
  type: 'google';
  email: string;
  sub: string; // Google unique ID
};

type AuthPayload = NormalAuthPayload | GoogleAuthPayload;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(UserApp)
    private userAppsRepo: Repository<UserApp>,
    @InjectRepository(Workflow)
    private workflowsRepo: Repository<Workflow>,
  ) {}

  async findUserByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findUserApps(userId: number): Promise<UserApp[]> {
    return this.userAppsRepo.find({ where: { user: { id: userId } } });
  }

  // Add findOne method for AuthService compatibility
  async findOne(email: string): Promise<User | null> {
    return this.findUserByEmail(email);
  }

  async findUserById(id: number): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async create(params: AuthPayload): Promise<User> {
    if (params.type === 'google') {
      console.log('here here');
      const { email, type, sub } = params;
      const user = this.usersRepo.create({
        email,
        provider: type,
        providerId: sub,
      });
      return this.usersRepo.save(user);
    } else {
      const { email, type, password } = params;
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = this.usersRepo.create({
        email,
        password: hashedPassword,
        provider: type,
      });
      return this.usersRepo.save(user);
    }
  }

  // Delete user app
  async deleteUserApp(userAppId: number, appName: string, userId: number) {
    await this.userAppsRepo.delete({ id: userAppId, appName });
    await this.workflowsRepo.delete({ user: { id: userId } });
    return { message: 'User app deleted successfully' };
  }
}

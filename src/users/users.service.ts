import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../db/db.user';
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
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  // Add findOne method for AuthService compatibility
  async findOne(email: string): Promise<User | null> {
    return this.findByEmail(email);
  }

  async findById(id: number): Promise<User | null> {
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

  // Add password comparison method
}

import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../db/db.user';
import { UserApp } from 'src/db/db.user_app';
import { AuthModule } from '../auth/auth.module';
import { Workflow } from 'src/db/db.workflow';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserApp, Workflow]), AuthModule],
  controllers: [UserController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

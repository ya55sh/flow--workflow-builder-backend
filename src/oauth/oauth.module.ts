import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../db/db.user';
import { UserApp } from '../db/db.user_app';
import { AuthModule } from '../auth/auth.module';
import { OauthService } from './oauth.service';
import { OauthController } from './oauth.controller';
import { MailModule } from 'src/mailService/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserApp]), AuthModule, MailModule],
  controllers: [OauthController],
  providers: [OauthService],
  exports: [OauthService],
})
export class OauthModule {}

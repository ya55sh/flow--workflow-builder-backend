import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserApp } from '../db/db.user_app';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { GmailIntegration } from './gmail.integration';
import { SlackIntegration } from './slack.integration';
import { GitHubIntegration } from './github.integration';
import { CacheService } from './cache.service';
import { OauthModule } from '../oauth/oauth.module';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserApp]),
    OauthModule,
    AuthModule,
    DbModule,
  ],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    GmailIntegration,
    SlackIntegration,
    GitHubIntegration,
    CacheService,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}

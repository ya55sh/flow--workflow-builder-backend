import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthService } from './jwt.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret:
        process.env.JWT_SECRET || 'fallback-secret-key-change-in-production',
      signOptions: { expiresIn: '60h' },
    }),
  ],
  providers: [AuthService, JwtAuthService],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthService],
})
export class AuthModule {}

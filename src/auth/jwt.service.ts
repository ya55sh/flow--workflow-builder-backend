import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../db/db.user';

@Injectable()
export class JwtAuthService {
  constructor(private jwtService: JwtService) {}

  // Generate JWT token for any user
  generateToken(user: User): string {
    const payload = { sub: user.id, useremail: user.email };
    return this.jwtService.sign(payload);
  }

  // Generate JWT token asynchronously
  async generateTokenAsync(user: User): Promise<string> {
    const payload = { sub: user.id, useremail: user.email };
    return await this.jwtService.signAsync(payload);
  }
}

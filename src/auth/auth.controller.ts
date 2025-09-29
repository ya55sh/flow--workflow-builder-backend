import { Controller } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor() {}

  // Auth endpoints moved to UserController
  // This controller can be used for other auth-related endpoints if needed
}

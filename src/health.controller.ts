// src/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  check() {
    return { status: 'ok', uptime: process.uptime(), timestamp: new Date() };
  }
}

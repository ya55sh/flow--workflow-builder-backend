import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { AppsCatalog } from '../oauth/apps.config';
import { AuthGuard } from '../auth/auth.guard';
import type { Request } from 'express';

@Controller('workflows')
@UseGuards(AuthGuard) // Protect all routes
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}
  @Post('/create')
  create(@Req() req: Request, @Body() body: any) {
    return this.workflowsService.create(req.user, body);
  }

  @Get()
  findAll(@Req() req: Request) {
    console.log('goiing in plain get all');
    return this.workflowsService.findAll(req.user);
  }

  @Get('apps')
  getApps() {
    return Object.entries(AppsCatalog).map(([appName, config]) => ({
      id: config.id,
      appName,
      displayName: config.displayName,
      logo: config.logo,
      scopes: config.scopes,
      triggerScopes: config.triggerScopes,
      actionScopes: config.actionScopes,
      triggers: config.triggers,
      actions: config.actions,
    }));
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    console.log('goiing in plain get by id');
    return this.workflowsService.findOne(+id, req.user);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.workflowsService.update(+id, req.user, body);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    console.log('Deleting workflow with id:', id);
    return this.workflowsService.remove(+id, req.user);
  }
}

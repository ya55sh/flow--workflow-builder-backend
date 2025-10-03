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
    return this.workflowsService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
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

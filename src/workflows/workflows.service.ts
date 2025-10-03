import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../db/db.workflow';
import { Action } from '../db/db.action';
import { Trigger } from '../db/db.trigger';
import { User } from '../db/db.user';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow)
    private workflowsRepo: Repository<Workflow>,
    @InjectRepository(Action)
    private actionsRepo: Repository<Action>,
    @InjectRepository(Trigger)
    private triggersRepo: Repository<Trigger>,
  ) {}

  async create(user: User, data: Partial<Workflow>): Promise<Workflow> {
    console.log('Creating workflow for user:', user);
    console.log('Workflow data:', data);
    //
    try {
      const description = data.description;
      const name = data.name;
      const actions = data.actions;
      const triggers = data.trigger;

      if (!name) {
        throw new BadRequestException(
          'At least one trigger is required to create a workflow',
        );
      }

      if (!description) {
        throw new BadRequestException(
          'At least one trigger is required to create a workflow',
        );
      }

      if (!actions || actions.length === 0) {
        throw new BadRequestException(
          'At least one trigger is required to create a workflow',
        );
      }

      if (!triggers) {
        throw new BadRequestException(
          'At least one trigger is required to create a workflow',
        );
      }

      const existingWorkflow: Workflow[] = await this.workflowsRepo.find({
        where: { name, user: { id: user.id } },
      });

      for (const ew of existingWorkflow) {
        console.log('Existing workflow check:', ew);
        if (ew.name === name) {
          throw new BadRequestException(
            'At least one trigger is required to create a workflow',
          );
        }
      }

      console.log('anme', name, description, user);
      const workflow = this.workflowsRepo.create({ name, description, user });

      await this.workflowsRepo.save(workflow);
      console.log('CROSSED');

      for (let action = 0; action < actions.length; action++) {
        const tempaction = this.actionsRepo.create({
          type: actions[action].type,
          config: actions[action].config,
          orderNo: action + 1,
          workflow,
        });
        await this.actionsRepo.save(tempaction);
      }

      const trigger = this.triggersRepo.create({
        type: triggers.type,
        config: triggers.config,
        workflow,
      });
      await this.triggersRepo.save(trigger);

      return workflow;
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw error;
    }
  }

  async findAll(user: User): Promise<Workflow[]> {
    const workflows = await this.workflowsRepo.find({
      where: { user: { id: user.id } },
    });
    console.log('Found workflows for user:', user, workflows);

    if (!workflows) {
      throw new NotFoundException('No workflows found for this user');
    }

    return workflows;
  }

  async findOne(id: number, user: User): Promise<Workflow> {
    const workflow = await this.workflowsRepo.findOne({
      where: { id, user: { id: user.id } },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }
    return workflow;
  }

  async update(
    id: number,
    user: User,
    updateData: Partial<Workflow>,
  ): Promise<Workflow> {
    const workflow = await this.findOne(id, user);
    Object.assign(workflow, updateData);
    return this.workflowsRepo.save(workflow);
  }

  async remove(id: number, user: User): Promise<void> {
    console.log('Removing workflow with id:', id, 'for user:', user);
    const workflow = await this.findOne(id, user);
    await this.workflowsRepo.remove(workflow);
  }
}

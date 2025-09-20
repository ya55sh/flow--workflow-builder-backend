import { Controller, Body, Get, Post } from '@nestjs/common';
import { UserService } from '../user/user.service';

@Controller(`user`)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getUsers(): string {
    return this.userService.getUsers();
  }

  @Post('/create')
  createUser(@Body() payload: any): string {
    return this.userService.createUser(payload);
  }

  @Post('/login')
  login(@Body() payload: any): string {
    return this.userService.login(payload);
  }
}

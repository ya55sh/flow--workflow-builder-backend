import {
  Controller,
  Body,
  Post,
  Get,
  Res,
  Req,
  UseGuards,
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthService } from 'src/auth/auth.service';
import { AuthGuard } from '../auth/auth.guard';
import { JwtAuthService } from 'src/auth/jwt.service';
import type { Response, Request } from 'express';

type NormalAuthPayload = {
  type: 'normal';
  email: string;
  password: string;
  confirmPassword: string;
};

type GoogleAuthPayload = {
  type: 'google';
  email: string;
  sub: string; // Google unique ID
};

type AuthPayload = NormalAuthPayload | GoogleAuthPayload;

type NormalLoginPayload = {
  type: 'normal';
  email: string;
  password: string;
};

type GoogleLoginPayload = {
  type: 'google';
  email: string;
  sub: string; // Google unique ID
};

type LoginPayload = NormalLoginPayload | GoogleLoginPayload;

@Controller(`user`)
export class UserController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly jwtAuthService: JwtAuthService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  async getUser(@Req() req: Request, @Res() res: Response): Promise<any> {
    try {
      console.log('Get user payload:', req['user']);
      const user = await this.usersService.findUserById(Number(req.user.id));
      const userApp = await this.usersService.findUserApps(Number(req.user.id));

      if (user) {
        return res.status(200).json({ user, userApp });
      } else {
        return res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      console.log('Error fetching user', error);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  @Post('signup')
  async createUser(
    @Body() payload: AuthPayload,
    @Res() res: Response,
  ): Promise<any> {
    try {
      if (payload.type === 'google') {
        // Handle Google OAuth signup/login
        let user = await this.usersService.findUserByEmail(payload.email);
        if (!user) {
          user = await this.usersService.create(payload);

          const access_token =
            await this.jwtAuthService.generateTokenAsync(user);
          return res.status(201).json({
            message: 'User created successfully',
            userId: user.id,
            type: 'google',
            access_token,
          });
        } else {
          return res
            .status(409)
            .json({ message: 'User already exists', userId: user.id });
        }
      } else if (payload.type === 'normal') {
        const existingUser = await this.usersService.findUserByEmail(
          payload.email,
        );
        if (!existingUser) {
          if (payload.password !== payload.confirmPassword) {
            return res.status(401).json({ error: 'Passwords do not match' });
          }
          const user = await this.usersService.create(payload);
          return res.status(201).json({
            message: 'User created successfully',
            userId: user.id,
            type: 'normal',
          });
        } else {
          return { error: 'User already exists' };
        }
      }
    } catch (error) {
      console.log('Error failed to create user', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }

  @Post('login')
  async login(
    @Body() payload: LoginPayload,
    @Res() res: Response,
  ): Promise<any> {
    try {
      console.log('Login payload:', payload);

      if (payload.type === 'google') {
        // Handle Google OAuth login
        let user = await this.usersService.findUserByEmail(payload.email);
        if (!user) {
          // User doesn't exist, create them
          user = await this.usersService.create(payload);
          const access_token =
            await this.jwtAuthService.generateTokenAsync(user);
          return res.status(201).json({
            message: 'User created and logged in successfully',
            userId: user.id,
            access_token,
          });
        } else {
          // User exists, generate token
          const access_token =
            await this.jwtAuthService.generateTokenAsync(user);
          return res.status(200).json({
            message: 'Google login successful',
            type: 'google',
            userId: user.id,
            access_token,
          });
        }
      } else if (payload.type === 'normal') {
        // Handle normal email/password login
        const user = await this.usersService.findUserByEmail(payload.email);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Check if user has a password (not a Google-only user)
        if (!user.password) {
          return res
            .status(401)
            .json({ error: 'This account uses Google authentication' });
        }

        const isValidPassword = await this.authService.validatePassword(
          payload.password,
          user.password,
        );

        if (!isValidPassword) {
          return res.status(401).json({ error: 'Invalid password' });
        }

        const access_token = await this.jwtAuthService.generateTokenAsync(user);

        return res.status(200).json({
          message: 'Login successful',
          type: 'google',
          userId: user.id,
          access_token,
        });
      } else {
        return res.status(400).json({ error: 'Invalid authentication type' });
      }
    } catch (error) {
      console.log('Error login failed', error);
      return res.status(500).json({ error: 'Login failed' });
    }
  }

  @Post('app/:appName/delete')
  @UseGuards(AuthGuard)
  async deleteUserApp(
    @Req() req: Request,
    @Res() res: Response,
    @Param('appName') appName: string,
  ): Promise<any> {
    try {
      const userApps = await this.usersService.findUserApps(
        Number(req.user.id),
      );
      const userApp = userApps.find((userApp) => userApp.appName === appName);

      if (!userApp) {
        return res.status(404).json({ error: 'User app not found' });
      }
      await this.usersService.deleteUserApp(userApp.id, appName, req.user.id);
      return res.status(200).json({ message: 'User app deleted successfully' });
    } catch (error) {
      console.log('Error deleting user app', error);
      return res.status(500).json({ error: 'Failed to delete user app' });
    }
  }
}

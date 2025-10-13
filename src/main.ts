import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import { config } from 'dotenv';

async function bootstrap() {
  config();

  const app = await NestFactory.create(AppModule);
  app.use('/logos', express.static(join(__dirname, '..', 'logos')));

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // allow cookies/auth headers if needed
  });

  await app.listen(process.env.PORT!, () => {
    console.log(
      `Server is running on http://localhost:${process.env.PORT ?? 3000}`,
    );
  });
}
bootstrap();

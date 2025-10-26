import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import { config as dotenvConfig } from 'dotenv';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// const localtunnel = require("localtunnel");
import localtunnel from 'localtunnel';
import { SchedulerService } from './queue/scheduler.service';

/**
 * Bootstrap function - Entry point of the application
 * Initializes the NestJS application and configures:
 * - API prefix (all routes under /api)
 * - CORS for cross-origin requests
 * - Static file serving for logos
 * - Swagger API documentation
 * - Workflow scheduler for background polling
 * - Localtunnel for webhook testing
 */
async function bootstrap() {
  // Load environment variables from .env file
  dotenvConfig();

  const app = await NestFactory.create(AppModule);

  // Set global prefix for all routes (e.g., /api/workflows instead of /workflows)
  app.setGlobalPrefix('api');

  // Serve static logo files from /logos directory
  app.use('/logos', express.static(join(__dirname, '..', 'logos')));

  // Enable Cross-Origin Resource Sharing (CORS) for frontend communication
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Allow cookies and auth headers
  });

  // Setup Swagger/OpenAPI Documentation for interactive API exploration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Workflow Builder API')
    .setDescription('API documentation for the Workflow Builder backend')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
      'JWT-auth', // Reference name for protected endpoints
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  console.log(
    'Swagger documentation available at: http://localhost:2000/api/docs',
  );

  // Start the HTTP server
  await app.listen(process.env.PORT!, () => {
    console.log(
      `Server is running on http://localhost:${process.env.PORT ?? 3000}`,
    );
  });

  // Start the workflow scheduler for background polling of active workflows
  const schedulerService = app.get(SchedulerService);
  schedulerService.startPolling();
  console.log('Workflow scheduler started');

  // Create a public tunnel for webhook testing (allows external services to call our webhooks)
  const tunnel = await localtunnel({
    port: 2000,
    subdomain: 'flow',
  });

  console.log('Tunnel URL:', tunnel?.url);
}

// Start the application
bootstrap();

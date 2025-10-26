# Workflow Builder Backend

A scalable workflow automation system built with NestJS that connects Gmail, Slack, and GitHub through automated workflows with triggers, conditions, and actions.

## Key Features

- Multi-app integration (Gmail, Slack, GitHub)
- OAuth 2.0 authentication with automatic token refresh
- Polling-based trigger detection (30-60 second intervals)
- Queue-based workflow execution with retry mechanisms
- Comprehensive logging and monitoring
- Interactive API documentation (Swagger UI)

---

## Technology Stack

### Core Framework

- NestJS v10.x (TypeScript)
- Node.js v18+
- Express

### Database & Queue

- PostgreSQL v14+ (TypeORM)
- Redis v6+ (BullMQ for job queue)

### Authentication & Security

- JWT (jsonwebtoken)
- bcrypt (password hashing)
- OAuth 2.0 (Google, Slack, GitHub)

### Third-Party APIs

- Gmail API
- Slack API
- GitHub API

---

## Supported Integrations

### Gmail

- Triggers: New email, starred email
- Actions: Send email, reply to email, add label, star email, mark as read

### Slack

- Triggers: New channel message, user joined channel
- Actions: Send message to channel

### GitHub

- Triggers: New issue, pull request opened, commit pushed, issue commented
- Actions: Create issue, add comment, close issue, assign issue

---

## Prerequisites

Before starting, ensure you have:

- Node.js v18.0.0 or higher
- PostgreSQL v14.0 or higher
- Redis v6.0 or higher
- OAuth credentials from:
  - [Google Cloud Console](https://console.cloud.google.com/) (Gmail)
  - [Slack API](https://api.slack.com/apps) (Slack)
  - [GitHub Settings](https://github.com/settings/developers) (GitHub)

---

## Installation

### 1. Clone and Install

```bash
git clone <repository-url>
cd flow--workflow-builder-backend
npm install
```

### 2. Database Setup

```bash
# Create database
psql -U postgres
CREATE DATABASE workflow_builder;
\q

# Run migrations
npm run migration:run
```

### 3. Redis Setup

```bash
# Start Redis server
redis-server

# Or using Docker
docker run -d -p 6379:6379 redis:latest
```

---

## Configuration

Create a `.env` file in the root directory:

```env
# Server
PORT=2000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=workflow_builder

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRATION=24h

# Google OAuth (Gmail)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:2000/api/oauth/callback/gmail
GOOGLE_AUTH_URI=https://accounts.google.com/o/oauth2/v2/auth
GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token

# Slack OAuth
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:2000/api/oauth/callback/slack
SLACK_AUTH_URI=https://slack.com/oauth/v2/authorize
SLACK_TOKEN_URI=https://slack.com/api/oauth.v2.access

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:2000/api/oauth/callback/github
GITHUB_AUTH_URI=https://github.com/login/oauth/authorize
GITHUB_TOKEN_URI=https://github.com/login/oauth/access_token
```

### OAuth Setup

1. **Gmail**: Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/), enable Gmail API, add redirect URI
2. **Slack**: Create app in [Slack API](https://api.slack.com/apps), add OAuth redirect URL and scopes
3. **GitHub**: Create OAuth App in [GitHub Settings](https://github.com/settings/developers), set callback URL

---

## Running the Application

### Development Mode

```bash
npm run start:dev
```

Server starts at `http://localhost:2000` with hot-reload enabled.

### Production Mode

```bash
npm run build
npm run start:prod
```

## API Documentation

### Interactive Swagger UI

Once the application is running, access the complete API documentation at:

```
http://localhost:2000/api/docs
```

The Swagger UI provides:

- Complete endpoint reference
- Request/response schemas with examples
- Try-it-out functionality
- Authentication setup (JWT Bearer token)

### Authentication

All protected endpoints require JWT authentication:

```bash
Authorization: Bearer <your_jwt_token>
```

---

## Project Structure

```
src/
├── auth/               # JWT authentication and guards
├── oauth/              # OAuth 2.0 flow handling
├── users/              # User management
├── workflows/          # Workflow CRUD and execution
├── integrations/       # Gmail, Slack, GitHub API integrations
├── queue/              # BullMQ queue and background scheduler
├── db/                 # TypeORM entities and logging service
├── migrations/         # Database migrations
├── types/              # TypeScript type definitions
├── app.module.ts       # Root application module
├── main.ts             # Application entry point
└── data-source.ts      # TypeORM configuration
```

---

## Quick Start Guide

### 1. Register User

```bash
POST /api/auth/register
Body: {"email": "user@example.com", "password": "password123"}
```

### 2. Login

```bash
POST /api/auth/login
Body: {"email": "user@example.com", "password": "password123"}
Response: {"access_token": "..."}
```

### 3. Connect Apps (via browser)

```bash
GET /api/oauth/gmail?userId=1
GET /api/oauth/slack?userId=1
```

### 4. Create Workflow

```bash
POST /api/workflows
Headers: {"Authorization": "Bearer <token>"}
Body: {
  "workflow": {
    "workflowName": "Gmail to Slack",
    "steps": [...]
  }
}
```

### 5. View Logs

```bash
GET /api/logs/workflow/:workflowId
Headers: {"Authorization": "Bearer <token>"}
```

## How It Works

1. **Background Scheduler**: Polls active workflows every 30 seconds
2. **Trigger Detection**: Checks for new emails, messages, or issues via API calls
3. **Queue System**: Adds triggered workflows to Redis queue (BullMQ)
4. **Worker Execution**: Processes workflows with retry mechanism (3 attempts)
5. **Action Execution**: Calls third-party APIs (Gmail, Slack, GitHub)
6. **Logging**: Records all events to database for monitoring

---

## Additional Documentation

- **Detailed Technical Report**: See `WORKFLOW_EXECUTION_FLOW_REPORT.md` for complete end-to-end flow
- **API Reference**: Visit `http://localhost:2000/api/docs` after starting the server
- **Code Documentation**: Comprehensive inline comments throughout the codebase

---

## Production Deployment

### Essential Checklist

- Set `NODE_ENV=production`
- Use strong JWT secret (32+ characters)
- Enable database SSL
- Configure Redis password
- Set up HTTPS/TLS
- Configure CORS for production domain
- Set up monitoring and error tracking

---

## Support

For issues or questions, refer to:

- Swagger API docs: `http://localhost:2000/api/docs`
- Process diagram: `WORKFLOW_EXECUTION_FLOW_REPORT.md`

---

**Version**: 1.0.0

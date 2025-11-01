# Workflow Builder Backend

A scalable workflow automation system built with NestJS that connects Gmail, Slack, and GitHub through automated workflows with triggers, conditions, and actions.

Link-> https://flow-workflow-builder-frontend.vercel.app/

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

### Option 1: Docker (Recommended)

- Docker v20.10 or higher
- Docker Compose v2.0 or higher
- OAuth credentials (see OAuth Setup section)

### Option 2: Local Development

- Node.js v18.0.0 or higher
- PostgreSQL v14.0 or higher
- Redis v6.0 or higher
- OAuth credentials from:
  - [Google Cloud Console](https://console.cloud.google.com/) (Gmail)
  - [Slack API](https://api.slack.com/apps) (Slack)
  - [GitHub Settings](https://github.com/settings/developers) (GitHub)

---

## 🐳 Docker Installation (Recommended)

The easiest way to get started is using Docker. This automatically sets up PostgreSQL, Redis, and the application.

### Quick Start with Docker

```bash
# 1. Clone the repository
git clone <repository-url>
cd flow--workflow-builder-backend

# 2. Start all services (Linux/Mac)
./docker-scripts.sh start-all

# Or on Windows
docker-scripts.bat start-all

# 3. Access the application
# API: http://localhost:2000/api
# Swagger: http://localhost:2000/api/docs
```

The script will automatically create a `.env` file with default values. Update the OAuth credentials in `.env` before connecting apps.

### Docker Commands

```bash
# Start all services (PostgreSQL, Redis, App)
./docker-scripts.sh start-all

# Start only database services for local development
./docker-scripts.sh start-dev

# Stop all services
./docker-scripts.sh stop

# View logs
./docker-scripts.sh logs

# Run migrations
./docker-scripts.sh migrate

# Rebuild after code changes
./docker-scripts.sh rebuild

# Clean everything (removes all data)
./docker-scripts.sh clean

# Show all available commands
./docker-scripts.sh help
```

### Manual Docker Commands

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Run migrations
docker-compose exec app npm run migration:run

# Stop all services
docker-compose down

# Remove all data
docker-compose down -v
```

For detailed Docker documentation, see [DOCKER.md](DOCKER.md).

---

## Local Installation (Without Docker)

If you prefer to run the application directly on your machine:

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
CREATE DATABASE flow_db;
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

Create a `.env` file in the root directory (automatically created by `docker-scripts.sh` or create manually):

```env
# Application
PORT=2000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=root
DB_NAME=flow_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRES_IN=7d

# Tunnel (optional - for webhook testing)
ENABLE_TUNNEL=false

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:2000/api/oauth/github/callback

# Slack OAuth
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:2000/api/oauth/slack/callback

# Google OAuth (for Gmail)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:2000/api/oauth/app/gmail/callback
GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token
```

**Note**: When using Docker, set `DB_HOST=postgres` and `REDIS_HOST=redis` (already configured in docker-compose.yml)

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

- **Docker Setup Guide**: See `DOCKER.md` for complete Docker documentation
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

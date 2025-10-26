#!/bin/bash

# Flow Workflow Builder - Docker Helper Scripts
# This script provides convenient commands for managing Docker services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

function print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

function print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

function show_help() {
    echo "Flow Workflow Builder - Docker Helper"
    echo ""
    echo "Usage: ./docker-scripts.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start-all       Start all services (PostgreSQL, Redis, App)"
    echo "  start-dev       Start only PostgreSQL and Redis for local development"
    echo "  stop            Stop all services"
    echo "  restart         Restart all services"
    echo "  rebuild         Rebuild and restart the app"
    echo "  logs            View logs from all services"
    echo "  logs-app        View only app logs"
    echo "  shell           Open shell in app container"
    echo "  migrate         Run database migrations"
    echo "  clean           Stop all services and remove volumes (DELETES DATA)"
    echo "  status          Show status of all services"
    echo "  help            Show this help message"
    echo ""
}

function check_env() {
    if [ ! -f .env ]; then
        print_warning ".env file not found!"
        print_info "Creating .env file with default values..."
        cat > .env << 'EOF'
# Application
PORT=2000
NODE_ENV=development

# Database
DB_USER=postgres
DB_PASSWORD=root
DB_NAME=flow_db

# Redis
REDIS_PORT=6379

# JWT
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRES_IN=7d

# Tunnel (set to true to enable localtunnel)
ENABLE_TUNNEL=false

# GitHub OAuth (set your values)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:2000/api/oauth/github/callback

# Slack OAuth (set your values)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:2000/api/oauth/slack/callback

# Google OAuth for Gmail (set your values)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:2000/api/oauth/app/gmail/callback
GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token
EOF
        print_info ".env file created. Please update OAuth credentials before starting."
    fi
}

case "$1" in
    start-all)
        check_env
        print_info "Starting all services..."
        docker-compose up -d
        print_info "Services started!"
        print_info "App: http://localhost:2000/api"
        print_info "Swagger: http://localhost:2000/api/docs"
        ;;
    
    start-dev)
        check_env
        print_info "Starting PostgreSQL and Redis only..."
        docker-compose -f docker-compose.dev.yml up -d
        print_info "Development services started!"
        print_info "PostgreSQL: localhost:5432"
        print_info "Redis: localhost:6379"
        print_info "Run 'npm run start:dev' to start the app locally"
        ;;
    
    stop)
        print_info "Stopping all services..."
        docker-compose down
        docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
        print_info "All services stopped."
        ;;
    
    restart)
        print_info "Restarting services..."
        docker-compose restart
        print_info "Services restarted."
        ;;
    
    rebuild)
        print_info "Rebuilding app container..."
        docker-compose up -d --build app
        print_info "App rebuilt and restarted."
        ;;
    
    logs)
        docker-compose logs -f
        ;;
    
    logs-app)
        docker-compose logs -f app
        ;;
    
    shell)
        print_info "Opening shell in app container..."
        docker-compose exec app sh
        ;;
    
    migrate)
        print_info "Running database migrations..."
        docker-compose exec app npm run migration:run
        print_info "Migrations completed."
        ;;
    
    clean)
        print_warning "This will REMOVE ALL DATA from PostgreSQL and Redis!"
        read -p "Are you sure? (yes/no): " -r
        if [[ $REPLY =~ ^[Yy]es$ ]]; then
            print_info "Stopping services and removing volumes..."
            docker-compose down -v
            docker-compose -f docker-compose.dev.yml down -v 2>/dev/null || true
            print_info "All services and data removed."
        else
            print_info "Aborted."
        fi
        ;;
    
    status)
        docker-compose ps
        ;;
    
    help|"")
        show_help
        ;;
    
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac


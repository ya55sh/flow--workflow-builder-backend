@echo off
REM Flow Workflow Builder - Docker Helper Scripts (Windows)
REM This script provides convenient commands for managing Docker services

setlocal

if "%1"=="" goto help
if "%1"=="help" goto help
if "%1"=="start-all" goto start-all
if "%1"=="start-dev" goto start-dev
if "%1"=="stop" goto stop
if "%1"=="restart" goto restart
if "%1"=="rebuild" goto rebuild
if "%1"=="logs" goto logs
if "%1"=="logs-app" goto logs-app
if "%1"=="shell" goto shell
if "%1"=="migrate" goto migrate
if "%1"=="clean" goto clean
if "%1"=="status" goto status
goto help

:check-env
if not exist .env (
    echo [WARN] .env file not found!
    echo [INFO] Creating .env file with default values...
    (
        echo # Application
        echo PORT=2000
        echo NODE_ENV=development
        echo.
        echo # Database
        echo DB_USER=postgres
        echo DB_PASSWORD=root
        echo DB_NAME=flow_db
        echo.
        echo # Redis
        echo REDIS_PORT=6379
        echo.
        echo # JWT
        echo JWT_SECRET=change-this-secret-in-production
        echo JWT_EXPIRES_IN=7d
        echo.
        echo # Tunnel ^(set to true to enable localtunnel^)
        echo ENABLE_TUNNEL=false
        echo.
        echo # GitHub OAuth ^(set your values^)
        echo GITHUB_CLIENT_ID=
        echo GITHUB_CLIENT_SECRET=
        echo GITHUB_REDIRECT_URI=http://localhost:2000/api/oauth/github/callback
        echo.
        echo # Slack OAuth ^(set your values^)
        echo SLACK_CLIENT_ID=
        echo SLACK_CLIENT_SECRET=
        echo SLACK_REDIRECT_URI=http://localhost:2000/api/oauth/slack/callback
        echo.
        echo # Google OAuth for Gmail ^(set your values^)
        echo GOOGLE_CLIENT_ID=
        echo GOOGLE_CLIENT_SECRET=
        echo GOOGLE_REDIRECT_URI=http://localhost:2000/api/oauth/app/gmail/callback
        echo GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token
    ) > .env
    echo [INFO] .env file created. Please update OAuth credentials before starting.
)
goto :eof

:start-all
call :check-env
echo [INFO] Starting all services...
docker-compose up -d
echo [INFO] Services started!
echo [INFO] App: http://localhost:2000/api
echo [INFO] Swagger: http://localhost:2000/api/docs
goto end

:start-dev
call :check-env
echo [INFO] Starting PostgreSQL and Redis only...
docker-compose -f docker-compose.dev.yml up -d
echo [INFO] Development services started!
echo [INFO] PostgreSQL: localhost:5432
echo [INFO] Redis: localhost:6379
echo [INFO] Run 'npm run start:dev' to start the app locally
goto end

:stop
echo [INFO] Stopping all services...
docker-compose down
docker-compose -f docker-compose.dev.yml down 2>nul
echo [INFO] All services stopped.
goto end

:restart
echo [INFO] Restarting services...
docker-compose restart
echo [INFO] Services restarted.
goto end

:rebuild
echo [INFO] Rebuilding app container...
docker-compose up -d --build app
echo [INFO] App rebuilt and restarted.
goto end

:logs
docker-compose logs -f
goto end

:logs-app
docker-compose logs -f app
goto end

:shell
echo [INFO] Opening shell in app container...
docker-compose exec app sh
goto end

:migrate
echo [INFO] Running database migrations...
docker-compose exec app npm run migration:run
echo [INFO] Migrations completed.
goto end

:clean
echo [WARN] This will REMOVE ALL DATA from PostgreSQL and Redis!
set /p confirm="Are you sure? (yes/no): "
if /i "%confirm%"=="yes" (
    echo [INFO] Stopping services and removing volumes...
    docker-compose down -v
    docker-compose -f docker-compose.dev.yml down -v 2>nul
    echo [INFO] All services and data removed.
) else (
    echo [INFO] Aborted.
)
goto end

:status
docker-compose ps
goto end

:help
echo Flow Workflow Builder - Docker Helper
echo.
echo Usage: docker-scripts.bat [command]
echo.
echo Commands:
echo   start-all       Start all services (PostgreSQL, Redis, App)
echo   start-dev       Start only PostgreSQL and Redis for local development
echo   stop            Stop all services
echo   restart         Restart all services
echo   rebuild         Rebuild and restart the app
echo   logs            View logs from all services
echo   logs-app        View only app logs
echo   shell           Open shell in app container
echo   migrate         Run database migrations
echo   clean           Stop all services and remove volumes (DELETES DATA)
echo   status          Show status of all services
echo   help            Show this help message
echo.
goto end

:end
endlocal


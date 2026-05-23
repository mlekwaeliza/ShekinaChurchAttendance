@echo off
setlocal enabledelayedexpansion

echo === Church Attendance System - Windows Production Deployment ===

echo [1/4] Checking prerequisites...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed. Please install Node.js 18+ from https://nodejs.org
    exit /b 1
)

where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing PM2 globally...
    call npm install -g pm2
)

echo [2/4] Installing dependencies...
call npm ci --production
cd client
call npm ci
call npm run build
cd ..

echo [3/4] Configuring environment...
if not exist "server\.env" (
    echo Creating server\.env...
    for /f %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set SESSION_SECRET=%%i
    (
        echo PORT=3001
        echo NODE_ENV=production
        echo SESSION_SECRET=!SESSION_SECRET!
        echo CLIENT_URL=http://localhost:3000
        echo DB_PATH=./server/database.sqlite
        echo BACKUP_RETENTION_DAYS=30
    ) > server\.env
    echo IMPORTANT: Edit server\.env and configure your settings
)

echo [4/4] Starting application with PM2...
call pm2 delete church-attendance 2>nul
call pm2 start ecosystem.config.js --env production
call pm2 save

echo.
echo === Deployment Complete ===
echo Application: http://localhost:3001
echo PM2 Status: pm2 status
echo PM2 Logs: pm2 logs church-attendance
echo.
echo Next steps:
echo 1. Edit server\.env and configure your settings
echo 2. Run seed script: node scripts\seed-admin.js
echo 3. Set up reverse proxy (IIS, nginx, etc.) for production access

endlocal

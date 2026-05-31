#!/bin/bash
set -e

APP_DIR="/opt/church-attendance"
APP_USER="church"
NODE_VERSION="18"

echo "=== Church Attendance System - Production Deployment ==="

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo)"
  exit 1
fi

echo "[1/8] Installing system dependencies..."
apt-get update
apt-get install -y curl git build-essential nginx

echo "[2/8] Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

echo "[3/8] Creating application user and directory..."
id -u "$APP_USER" &>/dev/null || useradd -r -s /bin/false "$APP_USER"
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/logs"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "[4/8] Deploying application files..."
cd "$APP_DIR"

if [ -d ".git" ]; then
  git pull origin main
else
  echo "Clone your repository here or copy files to $APP_DIR"
  exit 1
fi

echo "[5/8] Installing dependencies..."
npm ci --production
cd client && npm ci && npm run build && cd ..

echo "[6/8] Configuring environment..."
if [ ! -f ".env" ]; then
  echo "Creating .env file..."
  SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  cat > .env << ENVEOF
PORT=3001
NODE_ENV=production
SESSION_SECRET=$SESSION_SECRET
CLIENT_URL=https://your-domain.com
DB_PATH=./server/database.sqlite
BACKUP_RETENTION_DAYS=30
ENVEOF
  chown "$APP_USER:$APP_USER" .env
  chmod 600 .env
  echo "IMPORTANT: Edit .env and set your CLIENT_URL to your actual domain"
fi

echo "[7/8] Installing and configuring PM2..."
npm install -g pm2
pm2 delete church-attendance 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER"

echo "[8/8] Configuring nginx..."
NGINX_CONF="/etc/nginx/sites-available/church-attendance"
NGINX_LINK="/etc/nginx/sites-enabled/church-attendance"

cp deploy/nginx.conf "$NGINX_CONF"
sed -i "s/your-domain.com/YOUR_DOMAIN/g" "$NGINX_CONF"

if [ -L "$NGINX_LINK" ]; then
  rm "$NGINX_LINK"
fi
ln -s "$NGINX_CONF" "$NGINX_LINK"

nginx -t && systemctl reload nginx

echo ""
echo "=== Deployment Complete ==="
echo "Application: http://localhost:3001"
echo "PM2 Status: pm2 status"
echo "PM2 Logs: pm2 logs church-attendance"
echo ""
echo "Next steps:"
echo "1. Edit .env and set CLIENT_URL to your domain"
echo "2. Update nginx.conf with your actual domain"
echo "3. Run certbot to get SSL certificate: certbot --nginx -d your-domain.com"
echo "4. Restart PM2 after config changes: pm2 restart church-attendance"
echo "5. Run seed script for admin user: node scripts/seed-admin.js"

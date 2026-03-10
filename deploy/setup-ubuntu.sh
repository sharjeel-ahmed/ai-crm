#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_NAME="pazo-crm"
APP_DIR="/var/www/${APP_NAME}"
APP_USER="${SUDO_USER:-$USER}"
APP_GROUP="${APP_USER}"
DOMAIN=""
REPO_URL=""
EMAIL=""
ENABLE_TLS="false"

usage() {
  cat <<EOF
Usage:
  bash deploy/setup-ubuntu.sh --repo <git_repo_url> --domain <domain> [options]

Required:
  --repo <url>          Git repository URL to clone on the VM
  --domain <domain>     Domain name for Nginx, for example crm.example.com

Optional:
  --app-dir <path>      Install directory (default: ${APP_DIR})
  --app-user <user>     Linux user to run the service (default: current sudo user)
  --app-group <group>   Linux group for the service (default: same as app user)
  --email <email>       Email for Certbot
  --enable-tls          Request a Let's Encrypt certificate with Certbot

Examples:
  bash deploy/setup-ubuntu.sh --repo git@github.com:you/ai-crm.git --domain crm.example.com
  bash deploy/setup-ubuntu.sh --repo https://github.com/you/ai-crm.git --domain crm.example.com --enable-tls --email ops@example.com
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_URL="$2"
      shift 2
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --app-user)
      APP_USER="$2"
      shift 2
      ;;
    --app-group)
      APP_GROUP="$2"
      shift 2
      ;;
    --email)
      EMAIL="$2"
      shift 2
      ;;
    --enable-tls)
      ENABLE_TLS="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${REPO_URL}" || -z "${DOMAIN}" ]]; then
  usage
  exit 1
fi

if [[ "${ENABLE_TLS}" == "true" && -z "${EMAIL}" ]]; then
  echo "--email is required when --enable-tls is set" >&2
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required" >&2
  exit 1
fi

echo "Installing system packages..."
sudo apt update
sudo apt install -y nginx curl git ca-certificates gnupg

if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "Preparing application directory..."
sudo mkdir -p "$(dirname "${APP_DIR}")"
sudo chown -R "${APP_USER}:${APP_GROUP}" "$(dirname "${APP_DIR}")"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "Cloning repository into ${APP_DIR}..."
  git clone "${REPO_URL}" "${APP_DIR}"
else
  echo "Repository already exists, pulling latest changes..."
  git -C "${APP_DIR}" pull --ff-only
fi

echo "Installing backend dependencies..."
npm --prefix "${APP_DIR}/backend" install

echo "Installing frontend dependencies..."
npm --prefix "${APP_DIR}/frontend" install --include=dev

echo "Building frontend..."
npm --prefix "${APP_DIR}/frontend" run build

if [[ ! -f "${APP_DIR}/backend/.env" ]]; then
  echo "Creating backend/.env from template..."
  cp "${APP_DIR}/backend/.env.example" "${APP_DIR}/backend/.env"
  chmod 600 "${APP_DIR}/backend/.env"
  echo "Edit ${APP_DIR}/backend/.env before exposing the app publicly."
fi

echo "Writing systemd service..."
sudo tee "/etc/systemd/system/${APP_NAME}.service" >/dev/null <<EOF
[Unit]
Description=Pazo CRM
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "Writing Nginx site..."
sudo tee "/etc/nginx/sites-available/${APP_NAME}" >/dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

if [[ -L "/etc/nginx/sites-enabled/default" ]]; then
  sudo rm -f /etc/nginx/sites-enabled/default
fi

sudo ln -sfn "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable "${APP_NAME}"
sudo systemctl restart "${APP_NAME}"
sudo systemctl reload nginx

if [[ "${ENABLE_TLS}" == "true" ]]; then
  echo "Installing Certbot and requesting certificate..."
  sudo apt install -y certbot python3-certbot-nginx
  sudo certbot --nginx --non-interactive --agree-tos -m "${EMAIL}" -d "${DOMAIN}" --redirect
fi

cat <<EOF

Deployment completed.

Next steps:
1. Edit ${APP_DIR}/backend/.env and set JWT_SECRET at minimum.
2. If this is the first boot, review logs with: journalctl -u ${APP_NAME} -f
3. Change the seeded admin password after first login.

Useful commands:
  sudo systemctl status ${APP_NAME}
  sudo systemctl restart ${APP_NAME}
  sudo nginx -t
EOF

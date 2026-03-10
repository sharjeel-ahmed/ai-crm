#!/usr/bin/env bash

set -euo pipefail

APP_NAME="pazo-crm"
APP_DIR="/var/www/${APP_NAME}"
BRANCH="master"
DOMAIN=""

usage() {
  cat <<EOF
Usage:
  bash deploy/update-ubuntu.sh [options]

Optional:
  --app-dir <path>      App directory (default: ${APP_DIR})
  --branch <branch>     Git branch to deploy (default: ${BRANCH})
  --domain <domain>     Domain to configure in Nginx
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
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

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "App directory does not contain a git repository: ${APP_DIR}" >&2
  exit 1
fi

echo "Updating repository..."
git -C "${APP_DIR}" fetch origin
git -C "${APP_DIR}" checkout "${BRANCH}"
git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"

echo "Installing backend dependencies..."
npm --prefix "${APP_DIR}/backend" install

echo "Installing frontend dependencies..."
npm --prefix "${APP_DIR}/frontend" install --include=dev

echo "Building frontend..."
npm --prefix "${APP_DIR}/frontend" run build

if [[ -n "${DOMAIN}" ]]; then
  echo "Updating Nginx site for ${DOMAIN}..."
  sudo tee "/etc/nginx/sites-available/${APP_NAME}" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
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

  if [[ -f "${APP_DIR}/backend/.env" ]]; then
    if grep -q '^GOOGLE_REDIRECT_URI=' "${APP_DIR}/backend/.env"; then
      sed -i "s|^GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=https://${DOMAIN}/api/email-accounts/callback|" "${APP_DIR}/backend/.env"
    else
      printf '\nGOOGLE_REDIRECT_URI=https://%s/api/email-accounts/callback\n' "${DOMAIN}" >> "${APP_DIR}/backend/.env"
    fi
  fi
fi

sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl restart "${APP_NAME}"
sudo systemctl reload nginx

echo "Deployment update completed."

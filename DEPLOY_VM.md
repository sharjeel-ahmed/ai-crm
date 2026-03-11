# Deploying Pazo CRM on a VM

This app can run as a single Node process behind Nginx:

- Express serves the API under `/api`
- Express also serves the built React app from `frontend/dist`
- SQLite stays on disk at `backend/data/crm.db` unless you set an absolute `DB_PATH`

## Recommended target

- Ubuntu 22.04 or 24.04
- Node.js 20
- Nginx
- `systemd`

## 1. Install system packages

```bash
sudo apt update
sudo apt install -y nginx curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## Fast path: one-script Ubuntu setup

If you want a single script for a fresh Ubuntu VM, use:

```bash
bash deploy/setup-ubuntu.sh --repo <your-repo-url> --domain your-domain.example
```

With automatic TLS:

```bash
bash deploy/setup-ubuntu.sh --repo <your-repo-url> --domain your-domain.example --enable-tls --email you@example.com
```

What the script does:

- installs Nginx and Node.js 20
- clones or updates the repo in `/var/www/pazo-crm`
- installs backend and frontend dependencies
- builds `frontend/dist`
- creates `backend/.env` from `backend/.env.example` if needed
- writes the `systemd` and Nginx configs
- starts the app
- optionally requests a Let's Encrypt certificate

You still need to open `backend/.env` and set a real `JWT_SECRET`.

## 2. Create app directory

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <your-repo-url> pazo-crm
cd pazo-crm
```

## 3. Install dependencies and build the frontend

```bash
cd /var/www/pazo-crm/backend
npm install

cd /var/www/pazo-crm/frontend
npm install --include=dev
npm run build
```

`frontend/dist` must exist before you start the backend in production.

## 4. Configure environment

```bash
cd /var/www/pazo-crm/backend
cp .env.example .env
```

Set at least these values in `/var/www/pazo-crm/backend/.env`:

```dotenv
PORT=3001
JWT_SECRET=use-a-long-random-secret
DB_PATH=./data/crm.db
FRONTEND_BASE_URL=https://your-domain.example
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-domain.example/api/email-accounts/callback
```

Notes:

- `JWT_SECRET` should not use the fallback in code.
- Keep `DB_PATH` as `./data/crm.db` if `systemd` runs with `WorkingDirectory=/var/www/pazo-crm/backend`.
- If you do not need Gmail sync yet, you can leave the Google values empty.

## 5. Run once to initialize the database

```bash
cd /var/www/pazo-crm/backend
node src/index.js
```

On first boot the app will:

- run migrations
- create the SQLite database
- seed the default stages
- seed the default admin user: `admin@pazo.com` / `admin123`

Stop it after confirming it starts, then change that password immediately after login.

## 6. Create the service

Copy the provided service file and adjust the `User` if needed:

```bash
sudo cp /var/www/pazo-crm/deploy/pazo-crm.service /etc/systemd/system/pazo-crm.service
sudo nano /etc/systemd/system/pazo-crm.service
```

Important fields:

- `User=deploy` should match your VM user, or another dedicated service user
- `WorkingDirectory=/var/www/pazo-crm/backend`
- `ExecStart=/usr/bin/node src/index.js`

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pazo-crm
sudo systemctl start pazo-crm
sudo systemctl status pazo-crm
```

Logs:

```bash
journalctl -u pazo-crm -f
```

## 7. Configure Nginx

Copy the sample vhost:

```bash
sudo cp /var/www/pazo-crm/deploy/nginx-pazo-crm.conf /etc/nginx/sites-available/pazo-crm
sudo nano /etc/nginx/sites-available/pazo-crm
```

Update:

- `server_name your-domain.example;`

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/pazo-crm /etc/nginx/sites-enabled/pazo-crm
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Add HTTPS

If your domain already points to the VM:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example
```

## 9. Updating the app later

```bash
cd /var/www/pazo-crm
git pull

cd /var/www/pazo-crm/backend
npm install

cd /var/www/pazo-crm/frontend
npm install --include=dev
npm run build

sudo systemctl restart pazo-crm
```

## Common issues

### Frontend loads but assets 404

You forgot to rebuild the frontend:

```bash
cd /var/www/pazo-crm/frontend
npm run build
```

### API works locally but not through the domain

Check:

- Nginx is proxying to `127.0.0.1:3001`
- the Node service is listening on port `3001`
- the firewall allows ports `80` and `443`

### Gmail OAuth callback fails

The OAuth redirect URI must exactly match:

```text
https://your-domain.example/api/email-accounts/callback
```

## Claude CLI Provider Setup

To use the Claude CLI as an AI provider (instead of API keys), install and authenticate it on the VM:

```bash
npm install -g @anthropic-ai/claude-code

# Run claude — it will display a URL to open in your browser
claude

# Open the URL on any machine, complete the OAuth login, and paste the token back
```

Verify the CLI works:

```bash
echo 'Say "connected" in one word.' | claude --print --output-format text --max-turns 1
```

Then select **Claude-CLI** as the active provider in the CRM's AI Settings page. No API key needed — it uses the local OAuth authentication.

## Copying the SQLite Database

To copy your local database to the VM:

```bash
scp ./backend/data/crm.db user@your-server:/var/www/pazo-crm/backend/data/
```

Make sure the `data/` directory exists on the server first.

## Email Sync Schedule

The background email worker runs automatically:

- **On server start** — syncs immediately
- **Every 12 hours** — via `setInterval` in the worker

Each cycle syncs Gmail for all enabled accounts, then runs the AI pipeline on unprocessed emails. The sync is incremental — it only fetches emails newer than the last sync date.

## Process Restarts

The `systemd` service file includes `Restart=always` with `RestartSec=5`, so the backend automatically restarts after a crash. No need for pm2.

Check service status and logs:

```bash
sudo systemctl status pazo-crm
journalctl -u pazo-crm -f
```

## Optional hardening

- Create a dedicated Linux user instead of using your login user
- Change the seeded admin password immediately
- Restrict inbound access to `22`, `80`, and `443`
- Back up `backend/data/crm.db`

# Pazo CRM

B2B SaaS CRM with AI-powered email extraction. Express + SQLite backend, React + Vite frontend.

## Commands

```bash
# Backend (port 3001)
cd backend && npm run dev      # start with nodemon
cd backend && npm run seed     # seed default data

# Frontend (port 5173, proxies /api to backend)
cd frontend && npm run dev     # vite dev server
cd frontend && npm run build   # production build
cd frontend && npm run lint    # eslint
```

## Stack

- **Backend**: Express, better-sqlite3, JWT auth, bcryptjs, helmet, cors
- **Frontend**: React 19, Vite, Tailwind CSS, Axios, Lucide icons, Recharts, react-hot-toast
- **DB**: SQLite with WAL mode, foreign keys ON. Migrations in `backend/src/db/migrations/`
- **No test suite configured**

## Project Layout

```
backend/src/
  index.js              # entry point, middleware setup, email worker
  controllers/          # business logic (auth, deals, contacts, companies, activities, suggestions, ai)
  routes/               # express route definitions
  middleware/            # authenticate (JWT Bearer), roles, errorHandler
  db/                   # connection.js, migrate.js, migrations/
  services/ai/          # AI extraction prompt, provider integrations
  services/gmail/       # OAuth sync
  utils/                # jwt.js, seed.js

frontend/src/
  pages/                # route-level components
  components/           # organized by feature (ai/, deals/, contacts/, dashboard/)
  api/client.js         # axios instance with token injection + 401 redirect
  context/AuthContext   # auth state management
```

## Key Patterns

- **Auth**: JWT Bearer tokens. Roles: admin, manager, sales_rep. Middleware: `authenticate`, `authorizeRoles()`
- **API responses**: direct JSON (no wrapper). Errors: `{ error: "message" }`
- **DB timestamps**: `datetime('now')` for created_at/updated_at
- **Migrations**: idempotent SQL files (CREATE IF NOT EXISTS), numbered `001_`, `002_`
- **AI activities**: must link `deal_id`/`contact_id` by resolving `company_name` — never leave null. `created_at` must use the source email's date, not the approval time
- **Frontend state**: React Context (AuthContext only), local state via useState. No Redux/Zustand
- **Styling**: Tailwind utility classes only, no CSS files. Lucide for icons

## Gotchas

- Backend has no linting config — frontend does (eslint flat config)
- SQLite DB at `./data/crm.db` (env: DB_PATH) — single file, no server needed
- Vite proxies `/api` to `localhost:3001` in dev — see `vite.config.js`
- AI suggestions create entities via `applySuggestion()` in suggestionsController — resolve IDs from names, don't rely on AI providing database IDs
- Email worker runs on startup interval — check `index.js` for schedule

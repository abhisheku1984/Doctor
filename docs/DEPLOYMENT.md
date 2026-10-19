# Deployment Guide

## Requirements

- Node.js 20+ (developed on Node 22)
- SQLite file storage (zero external database dependency)
- HTTPS in production (terminate TLS at your reverse proxy / load balancer)
- Persistent disk for `data/` (the SQLite database)

## Build & run

```bash
npm install
npm run db:init          # first time only
npm run build
NODE_ENV=production SESSION_PASSWORD='<long-random-string>' npm start
```

## Environment variables

See `.env.example` for the full list. Required in production:

| Variable | Purpose |
|---|---|
| `SESSION_PASSWORD` | signs admin session cookies (32+ random chars) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` | admin auth (hash via `node scripts/hash-password.js`) |
| `APP_URL` | canonical public URL |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Calendar + Sheets (Live Mode) |
| `GOOGLE_CALENDAR_ID`, `GOOGLE_SHEETS_SPREADSHEET_ID` | resource IDs |
| `SMTP_*` | transactional email |
| `TWILIO_*` + `SMS_NOTIFICATIONS_ENABLED=true` | SMS |
| `CONSULTATION_PLATFORM` | online consult links |

## Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t drxyz-clinic .
docker run -p 3000:3000 --env-file .env -v ./data:/app/data drxyz-clinic
```

## Sync worker

The Sheets/Calendar retry queue is drained by Admin → Integrations (manual) or by a cron job:

```bash
# crontab — every 5 minutes
*/5 * * * * cd /path/to/app && node -e "import('./dist-sync-worker.js')"  # or use the admin API:
# curl -X POST -H "Cookie: drxyz_admin_session=..." /api/admin/sync
```

The queue also self-heals on the next booking that touches the same record.

## Security checklist

- [ ] HTTPS everywhere (HSTS)
- [ ] `SESSION_PASSWORD` is a long random string, unique per environment
- [ ] `ADMIN_PASSWORD_HASH` set (never a plaintext password)
- [ ] `data/` on a persistent, backed-up volume with restricted permissions
- [ ] Google service-account JSON stored in a secrets manager, never in Git
- [ ] Firewall: only 443 inbound; DB file not publicly reachable
- [ ] Regular backups of `data/clinic.db` and the Google Sheets register

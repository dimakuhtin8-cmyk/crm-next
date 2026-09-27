# 🚀 Deployment Guide

## Environments

| Environment | URL                 | Branch      | Purpose     |
| ----------- | ------------------- | ----------- | ----------- |
| Local       | localhost:3000      | any         | Development |
| Staging     | staging.crm-next.ua | develop     | Testing     |
| Production  | crm-next.ua         | main/master | Live        |

---

## 🏠 Local Development

### Option 1: Direct (recommended for development)

```bash
# Install dependencies
pnpm install

# Start all services
pnpm dev

# Or start individual services
pnpm --filter @crm-next/web dev    # http://localhost:3000
pnpm --filter @crm-next/api dev    # http://localhost:4000
pnpm --filter @crm-next/bot dev
```

### Option 2: Docker Compose (with emulators)

```bash
# Start with Firebase emulators
docker compose up -d

# Access services:
# - Web App: http://localhost:3000
# - API: http://localhost:4000
# - Firebase UI: http://localhost:4000
# - Ollama: http://localhost:11434

# View logs
docker compose logs -f

# Stop all
docker compose down
```

---

## 🧪 Staging

### Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init --name crm-next-staging

# Deploy API
railway up --service crm-next-api --environment staging

# Deploy Bot
railway up --service crm-next-bot --environment staging
```

### Vercel (Web)

```bash
# Set environment
vercel env pull .env.staging

# Deploy to staging
vercel --env .env.staging
```

---

## 🏭 Production

### Prerequisites

- [ ] Domain configured (crm-next.ua)
- [ ] SSL certificate (Let's Encrypt)
- [ ] Firebase production project
- [ ] LiqPay production keys
- [ ] Stripe production keys
- [ ] Sentry project

### Docker Compose Deployment

```bash
# Clone on server
git clone https://github.com/dimakuhtin8-cmyk/crm-next.git
cd crm-next

# Create production env
cp .env.production .env.local
# Edit .env.local with real values

# Start production
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Update deployment
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### SSL Certificate (Let's Encrypt)

```bash
# Initial certificate
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  -d crm-next.ua \
  -d www.crm-next.ua

# Auto-renewal is handled by certbot service in docker-compose.prod.yml
```

---

## 🔐 GitHub Secrets

Required secrets for CI/CD:

| Secret                   | Description              |
| ------------------------ | ------------------------ |
| `VERCEL_TOKEN`           | Vercel API token         |
| `VERCEL_ORG_ID`          | Vercel organization ID   |
| `VERCEL_PROJECT_ID`      | Vercel project ID        |
| `RAILWAY_TOKEN`          | Railway API token        |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web config      |
| `FIREBASE_PRIVATE_KEY`   | Firebase service account |
| `LIQPAY_*`               | LiqPay API keys          |
| `STRIPE_SECRET_KEY`      | Stripe secret key        |
| `SENTRY_DSN`             | Sentry DSN               |

---

## 📊 Monitoring

| Service           | URL                         | Purpose        |
| ----------------- | --------------------------- | -------------- |
| Vercel Analytics  | vercel.com/dashboard        | Web vitals     |
| Railway Dashboard | railway.app                 | API/Bot status |
| Firebase Console  | console.firebase.google.com | Database       |
| Sentry            | sentry.io                   | Error tracking |

---

## 🔄 Rollback

### Vercel

```bash
vercel ls                  # List deployments
vercel rollback <url>      # Rollback to specific deployment
```

### Railway

```bash
railway deploy --service crm-next-api  # Re-deploy previous version
```

### Docker

```bash
docker compose -f docker-compose.prod.yml down
git checkout <previous-commit>
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Внешний планировщик (обязательно для очереди и timer-автоматизаций)

Фоновые задачи живут в таблице `QueueJob` (Postgres) и обрабатываются
роутом `POST /api/queue/process`, а timer-правила — роутом
`POST /api/automation/tick`. Оба вызываются ТОЛЬКО внешним планировщиком
(Vercel Hobby cron для этого не годится — лимит 1-2 запуска в день).

Оба роута защищены заголовком `x-cron-secret: <CRON_SECRET>`
(`CRON_SECRET` — переменная окружения на сервере, сгенерируй:
`openssl rand -hex 32`).

### Вариант A: GitHub Actions (рекомендуется)

Создай `.github/workflows/scheduler.yml` в репозитории:

```yaml
name: scheduler
on:
  schedule:
    - cron: '*/5 * * * *'   # очередь — каждые 5 минут
    - cron: '17 * * * *'    # timer-автоматизации — раз в час
  workflow_dispatch: {}     # + ручной запуск из UI

jobs:
  queue:
    if: github.event.schedule == '*/5 * * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - run: curl -sS -X POST "${APP_URL}/api/queue/process" -H "x-cron-secret: ${CRON_SECRET}" -H 'Content-Type: application/json' -d '{"limit": 10}'
        env:
          APP_URL: ${{ secrets.APP_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}

  tick:
    if: github.event.schedule == '17 * * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - run: curl -sS -X POST "${APP_URL}/api/automation/tick" -H "x-cron-secret: ${CRON_SECRET}"
        env:
          APP_URL: ${{ secrets.APP_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

Секреты `APP_URL` (https://твой-домен) и `CRON_SECRET` (тот же, что на
сервере) добавь в GitHub → Settings → Secrets and variables → Actions.

### Вариант B: cron-job.org (без кода)

Создай два задания с теми же URL, методом POST и заголовком
`x-cron-secret`: `queue/process` — каждые 5 минут,
`automation/tick` — раз в час.

### Проверка

Ответ роутов — JSON со статистикой вида
`{"success": true, "processed": N, "succeeded": M, "failed": K}`.
Мониторинг: Dashboard → Черги задач + таблица `QueueJob`.

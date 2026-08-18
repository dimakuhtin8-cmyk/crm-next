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

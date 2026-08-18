# Web App - Production
FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/*/package.json ./packages/*/

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source
COPY . .

# Build the app
RUN pnpm --filter @crm-next/web build

# Expose port
EXPOSE 3000

# Start production server
CMD ["pnpm", "--filter", "@crm-next/web", "start"]

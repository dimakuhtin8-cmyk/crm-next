# API - Production
FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/*/

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source
COPY . .

# Build the API
RUN pnpm --filter @crm-next/api build

# Expose port
EXPOSE 4000

# Start production server
CMD ["node", "apps/api/dist/index.js"]

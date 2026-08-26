# Stage 1: Install deps including native modules
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 && \
    npm ci && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Stage 2: Build
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production runner
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes server.js + pruned node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy static assets separately (not included in standalone by default)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Ensure data directory exists
RUN mkdir -p /app/data

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
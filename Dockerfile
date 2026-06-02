# Stage 1: Build client
FROM node:20.18.1-alpine AS client-builder

WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm ci --workspace client

COPY client/ ./client/
RUN npm run build --workspace client

# Stage 2: Production server
FROM node:20.18.1-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling + wget for HEALTHCHECK
RUN apk add --no-cache dumb-init wget

# Copy server dependencies
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --omit=dev --workspace server && npm cache clean --force

# Copy server code
COPY server/ ./server/

# Copy client build from stage 1. server/server.js serves ../client/dist from /app/server.
COPY --from=client-builder /app/client/dist ./client/dist

# Create required directories and grant the unprivileged user write access.
RUN mkdir -p server/uploads/profiles server/backups server/temp \
    && addgroup -S app && adduser -S app -G app \
    && chown -R app:app /app

# Drop root
USER app

# Set environment
ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001

# Healthcheck: hits /api/health and requires status field "ok" or "degraded".
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider \
      http://127.0.0.1:3001/api/health || exit 1

# Use dumb-init to handle signals properly
CMD ["dumb-init", "node", "server/server.js"]

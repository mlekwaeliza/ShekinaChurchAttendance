# Stage 1: Build client
FROM node:18-alpine AS client-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# Stage 2: Production server
FROM node:18-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --production && npm cache clean --force

# Copy server code
COPY server/ ./server/

# Copy client build from stage 1. server/server.js serves ../client/dist from /app/server.
COPY --from=client-builder /app/client/dist ./client/dist

# Create required directories
RUN mkdir -p server/uploads/profiles server/backups server/temp

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Use dumb-init to handle signals properly
CMD ["dumb-init", "node", "server/server.js"]

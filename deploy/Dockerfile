# syntax=docker/dockerfile:1.6

# ============================================================================
# Stage 1 — build the React client
# ============================================================================
FROM node:20-alpine AS client-build
WORKDIR /repo

# Install client deps in their own layer for caching
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# Bring in the rest of the client source and build
COPY client/ ./client/
RUN cd client && npm run build

# ============================================================================
# Stage 2 — install server deps and run
# ============================================================================
FROM node:20-alpine AS server

# Tools needed by sql.js native binaries in some environments
RUN apk add --no-cache curl tini

WORKDIR /app

# Install only production deps
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

# Copy server source
COPY server/ ./server/

# Copy the prebuilt React bundle from the previous stage
COPY --from=client-build /repo/client/build ./client/build

# Persistent data lives here; mount a volume to /app/server/data
RUN mkdir -p /app/server/data && chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5000/api/health || exit 1

# tini reaps zombies and forwards signals cleanly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/server.js"]

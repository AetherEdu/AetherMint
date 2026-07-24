# =============================================================================
# Stage 1: Build stage - compile TypeScript (uses root workspace lockfile)
# =============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies (Python for native modules like sharp, bcrypt)
RUN apk add --no-cache python3 py3-pip make g++

# Copy root package files for workspace resolution
COPY package.json package-lock.json ./
# Copy backend workspace package.json
COPY backend/package.json ./backend/package.json

# Install backend workspace dependencies (including devDependencies for TypeScript build)
RUN npm ci -w backend

# Copy backend source code
COPY backend/tsconfig.json ./backend/
COPY backend/src/ ./backend/src/

# Build TypeScript to JavaScript
RUN npm run build -w backend

# =============================================================================
# Stage 2: Production dependencies
# =============================================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install runtime OS dependencies (build tools needed for native modules like sharp)
RUN apk add --no-cache python3 py3-pip make g++

# Copy root package files
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY backend/requirements.txt* ./backend/

# Install only production Node.js dependencies for backend workspace
RUN npm ci --omit=dev -w backend

# Install Python dependencies if requirements.txt exists
RUN if [ -f backend/requirements.txt ]; then pip install --no-cache-dir -r backend/requirements.txt; fi

# =============================================================================
# Stage 3: Production runner
# =============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install minimal runtime dependencies (Python for native modules)
RUN apk add --no-cache python3 py3-pip curl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/backend/dist ./dist

# Copy package files for metadata
COPY --from=builder /app/backend/package.json ./

# Copy Python dependencies if installed
COPY --from=deps /usr/lib/python3* /usr/lib/python3*

# Create logs directory and set permissions
RUN mkdir -p logs && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

# Build-time arguments for image labeling
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Labels for image metadata
LABEL org.opencontainers.image.title="AetherMint Backend" \
      org.opencontainers.image.description="Backend API for AetherMint decentralized education platform" \
      org.opencontainers.image.source="https://github.com/AetherEdu/AetherMint" \
      org.opencontainers.image.version="${VERSION:-latest}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}"

# Health check – the liveness probe (`/health`) is used rather than the
# readiness probe (`/health/ready`) because Docker's healthcheck is binary:
# during a graceful shutdown, hitting dependency-backed readiness probes from
# the kubelet/orchestrator can cause the container to flap between healthy
# and unhealthy before it has finished draining. Liveness reflects only
# process state and is stable through shutdown.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]

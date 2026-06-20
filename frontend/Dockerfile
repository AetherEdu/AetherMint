# =============================================================================
# Stage 1: Install dependencies (uses root workspace lockfile)
# =============================================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json ./
# Copy frontend workspace package.json
COPY frontend/package.json ./frontend/package.json

# Install frontend workspace dependencies only (skip postinstall scripts — they patch
# dev-only ESM interop issues that are handled by webpack aliases in next.config.js)
RUN npm ci -w frontend --ignore-scripts

# =============================================================================
# Stage 2: Build the application
# =============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace config and installed dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY frontend/package.json ./frontend/package.json

# Copy frontend source code
COPY frontend/ ./frontend/

# Build Next.js with standalone output
WORKDIR /app/frontend
# Build-time env vars required by next.config.js validation
ARG NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS
ENV NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS=${NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS}
RUN npm run build

# Build-time arguments for image labeling
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# =============================================================================
# Stage 3: Production runner
# =============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output from builder
COPY --from=builder /app/frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static

# Ensure cache directory permissions
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Labels for image metadata
LABEL org.opencontainers.image.title="AetherMint Frontend" \
      org.opencontainers.image.description="Frontend for AetherMint decentralized education platform" \
      org.opencontainers.image.source="https://github.com/AetherEdu/AetherMint" \
      org.opencontainers.image.version="${VERSION:-latest}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}"

# Health check using Node.js built-in HTTP (no external tools needed)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health',r=>{process.exit(r.statusCode===200?0:1)})"

# Start Next.js server
CMD ["node", "server.js"]

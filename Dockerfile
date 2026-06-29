FROM node:22-slim AS builder

WORKDIR /app

# Install all dependencies including platform-specific native binaries (esbuild needs them)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:22-slim

WORKDIR /app

# Install only production dependencies (keep optional deps so esbuild binary is available)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "dist/index.js"]

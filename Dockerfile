# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
# Use npm install so a stale lockfile never blocks the build
RUN npm install --ignore-scripts=false

COPY . .
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:22-slim

# Real Python + Go toolchains for server/verify.ts -- previously this image
# could only ever verify Node/npm projects; imported Python/Go repos got a
# silent honest no-op instead of a real build/test check. python3/pip3 and
# golang-go are standard Debian packages, low risk, bounded apt install.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip golang-go \
    && find /var/lib/apt/lists -mindepth 1 -delete

WORKDIR /app

COPY package.json package-lock.json* ./
# install prod deps + optional so esbuild/rollup native binaries are present
RUN npm install --omit=dev --include=optional --ignore-scripts=false

# Copy built artifacts
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "dist/index.js"]

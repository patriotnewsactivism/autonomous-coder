# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
# Install ALL deps (including optional) so esbuild native binary is present
RUN npm ci --include=optional

# Copy built artifacts
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "dist/index.js"]

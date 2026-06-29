FROM node:22-slim AS builder

WORKDIR /app

# Install all deps (including devDeps needed for build)
COPY package.json package-lock.json ./
RUN npm install --no-optional

# Copy source and build
COPY . .
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:22-slim

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-optional

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

ENV PORT=10000
EXPOSE 10000

CMD ["node", "dist/index.js"]

FROM node:22-slim

WORKDIR /app

# Copy package files and install ONLY production dependencies
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-optional

# Copy pre-built artifacts
COPY dist ./dist

# Expose port (Render sets PORT env var automatically)
ENV PORT=10000
EXPOSE 10000

# Start
CMD ["node", "dist/index.js"]

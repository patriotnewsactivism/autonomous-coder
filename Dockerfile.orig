FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm install --include=dev

# Copy source
COPY . .

# Build frontend + backend
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --production

# Expose port
EXPOSE 5000

# Start
CMD ["npm", "start"]

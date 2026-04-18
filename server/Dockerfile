# ============================================================
# Backend Dockerfile
# Node.js + Express
# ============================================================
FROM node:20-alpine AS base

WORKDIR /app

# Install system dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create storage directory
RUN mkdir -p /app/storage

EXPOSE 4000

# Run DB push then start server
CMD ["sh", "-c", "npx prisma db push && node src/app.js"]

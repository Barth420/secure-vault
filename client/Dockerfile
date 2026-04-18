# ============================================================
# Frontend Dockerfile — Multi-stage build
# Stage 1: Build React app
# Stage 2: Serve with nginx
# ============================================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────
FROM nginx:alpine AS runner

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA router fallback — serve index.html for all routes
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { try_files $uri $uri/ /index.html; } \
  gzip on; \
  gzip_types text/plain text/css application/json application/javascript; \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

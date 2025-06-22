# Multi-stage build for optimized React app
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Production stage - serve with simple HTTP server
FROM node:18-alpine
RUN npm install -g serve

WORKDIR /app
COPY --from=builder /app/build ./build

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
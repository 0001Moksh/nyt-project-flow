# Multi-stage build for React Frontend
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application with environment variables
ARG VITE_API_BASE_URL=http://localhost:8080/api
ARG VITE_DEVA_API_BASE_URL=http://localhost:8080/api/deva

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_DEVA_API_BASE_URL=$VITE_DEVA_API_BASE_URL

RUN npm run build

# Runtime stage using nginx
FROM nginx:alpine

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5173/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

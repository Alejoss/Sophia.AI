# Multi-stage build for production frontend
# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (needed for build)
RUN npm ci

# Copy source code
COPY . .

# Accept build arguments for Vite environment variables
# These are injected at build time into the React app
ARG VITE_API_URL
ARG VITE_GOOGLE_OAUTH_CLIENT_ID
ARG VITE_GA_MEASUREMENT_ID
ARG VITE_META_PIXEL_ID
ARG VITE_SENTRY_DSN

# Set as environment variables for Vite build
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_GOOGLE_OAUTH_CLIENT_ID=${VITE_GOOGLE_OAUTH_CLIENT_ID}
ENV VITE_GA_MEASUREMENT_ID=${VITE_GA_MEASUREMENT_ID}
ENV VITE_META_PIXEL_ID=${VITE_META_PIXEL_ID}
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}

# Build the application
ARG BUILD_SHA=unknown
ENV VITE_BUILD_SHA=${BUILD_SHA}
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html
ARG BUILD_SHA=unknown
RUN echo "${BUILD_SHA}" > /usr/share/nginx/html/.build_sha

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

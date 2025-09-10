# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy all files
COPY . .

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S probot -u 1001

# Copy package files
COPY --from=builder /usr/src/app/package.json /usr/src/app/package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /usr/src/app/lib ./lib

# Copy templates directory (needed for setup issues)
COPY --from=builder /usr/src/app/src/templates ./src/templates

# Copy other necessary files
COPY --from=builder /usr/src/app/app.yml ./
COPY --from=builder /usr/src/app/.infra/start.sh ./
COPY --from=builder /usr/src/app/test/fixtures/mock-cert.pem ./test/fixtures/mock-cert.pem

# Make start script executable
RUN chmod +x start.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Change ownership to non-root user
RUN chown -R probot:nodejs /usr/src/app
USER probot

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/probot', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application
CMD ["./start.sh"]

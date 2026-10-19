# ============================================================================
# LINA MANUFACTURING · ENTERPRISE STOCK VERIFICATION CLOUD
# PRODUCTION DOCKERFILE (Lightweight, Secure Node.js 22 Alpine Runtime)
# ============================================================================

FROM node:22-alpine AS production

# Set environment
ENV NODE_ENV=production
ENV PORT=5173
ENV HOST=0.0.0.0

# Create working directory
WORKDIR /app

# Security: Create dedicated non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy package manifests
COPY package.json ./

# Copy application assets, database schemas, and server
COPY dev-server.js ./
COPY index.html ./
COPY Stock_Count_System_V5.html ./
COPY architecture_diagrams.html ./
COPY database/ ./database/
COPY vendor/ ./vendor/
COPY assets/ ./assets/

# Create persistent data directory and assign permissions
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

# Switch to non-root user for principle of least privilege
USER appuser

# Expose standard enterprise application port
EXPOSE 5173

# Healthcheck configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.get('http://localhost:5173/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1));"

# Start authoritative application server
CMD ["node", "dev-server.js"]

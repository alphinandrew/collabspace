# ==============================================================================
# CollabSpace Production Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Build the React frontend client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --prefer-offline
COPY client/ ./
RUN npm run build

# Stage 2: Setup production server
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV DB_SQLITE_PATH=/app/data/collabspace.db
ENV STORAGE_LOCAL_DIR=/app/storage/uploads

# Install server dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --only=production

# Copy server source code
COPY server/src ./src

# Copy built frontend assets from client-builder stage
COPY --from=client-builder /app/client/dist /app/client/dist

# Create persistent storage directories
RUN mkdir -p /app/data /app/storage/uploads

EXPOSE 4000

CMD ["node", "src/index.js"]

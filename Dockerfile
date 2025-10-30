# Stage 1: Build
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/logos ./logos

# Expose application port
EXPOSE 2000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/main.js"]


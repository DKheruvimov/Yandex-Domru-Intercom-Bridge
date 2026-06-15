# Use a lightweight Node.js image
FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled build directory
COPY dist/ ./dist/

# Set production environment
ENV NODE_ENV=production

# Expose the application port
EXPOSE 3000

# Start the server
CMD ["node", "dist/server.cjs"]

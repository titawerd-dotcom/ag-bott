FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the application files
COPY . .

# Ensure data folder exists
RUN mkdir -p data

# Default port
ENV PORT=3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Start bot and web dashboard
CMD ["node", "src/index.js"]

# Dockerfile
FROM node:20-bullseye-slim

# Puppeteer / Chromium deps (minimal set that works for headless chromium)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    lsb-release \
    wget \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package manifests first (for caching)
COPY package*.json ./

# Install dependencies (will install puppeteer which downloads chromium)
# Use npm ci in production if package-lock.json present
RUN npm ci --only=production

# Copy app files
COPY . .

# Ensure comprobantes dir exists
RUN mkdir -p /usr/src/app/comprobantes && chown -R node:node /usr/src/app/comprobantes

# Expose port
ENV PORT=3000
EXPOSE 3000

# Use non-root user for extra safety
USER node

# Start
CMD ["node", "server.js"]

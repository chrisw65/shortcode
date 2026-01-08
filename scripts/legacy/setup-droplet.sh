#!/bin/bash

set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install doctl
cd /tmp
wget https://github.com/digitalocean/doctl/releases/latest/download/doctl-*-linux-amd64.tar.gz
tar xf doctl-*-linux-amd64.tar.gz
mv doctl /usr/local/bin
cd -

# Create app directory
mkdir -p /app
cd /app

# Login to registry
doctl registry login

# Create docker-compose.prod.yml
cat > docker-compose.prod.yml << 'DOCKER'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: shortlink
      POSTGRES_USER: shortlink
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

  app:
    image: registry.digitalocean.com/shortlink-registry/shortlink-api:latest
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
      - POSTGRES_HOST=postgres
      - POSTGRES_DB=shortlink
      - POSTGRES_USER=shortlink
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - REFRESH_SECRET=${REFRESH_SECRET}
      - APP_URL=${APP_URL}
      - SHORT_URL_BASE=${SHORT_URL_BASE}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  migrations:
    image: registry.digitalocean.com/shortlink-registry/shortlink-api:latest
    command: node scripts/migrate.js
    environment:
      - POSTGRES_HOST=postgres
      - POSTGRES_DB=shortlink
      - POSTGRES_USER=shortlink
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    depends_on:
      - postgres
    restart: "no"

volumes:
  postgres_data:
  redis_data:
DOCKER

echo "✓ Droplet setup completed!"

#!/bin/bash

set -e

# Configuration
DROPLET_NAME="shortlink-prod"
DROPLET_SIZE="s-2vcpu-2gb"
DROPLET_REGION="nyc3"
DROPLET_IMAGE="ubuntu-22-04-x64"

echo "Step 1: Building and pushing Docker image..."
./scripts/build-and-push.sh latest

echo ""
echo "Step 2: Checking if droplet exists..."
DROPLET_IP=$(doctl compute droplet list --format Name,PublicIPv4 --no-header | grep "^$DROPLET_NAME " | awk '{print $2}')

if [ -z "$DROPLET_IP" ]; then
  echo "Creating new droplet..."
  
  # Create droplet
  doctl compute droplet create $DROPLET_NAME \
    --size $DROPLET_SIZE \
    --image $DROPLET_IMAGE \
    --region $DROPLET_REGION \
    --ssh-keys $(doctl compute ssh-key list --format ID --no-header | head -1) \
    --wait
  
  # Get IP
  DROPLET_IP=$(doctl compute droplet list --format Name,PublicIPv4 --no-header | grep "^$DROPLET_NAME " | awk '{print $2}')
  
  echo "✓ Droplet created with IP: $DROPLET_IP"
  
  echo "Waiting for droplet to be ready..."
  sleep 30
  
  echo "Setting up droplet..."
  ssh -o StrictHostKeyChecking=no root@$DROPLET_IP 'bash -s' < scripts/setup-droplet.sh
else
  echo "✓ Droplet exists with IP: $DROPLET_IP"
fi

echo ""
echo "Step 3: Generating environment variables..."

# Generate secure passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
REFRESH_SECRET=$(openssl rand -base64 64)

# Create .env file
cat > /tmp/.env.prod << ENV
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
JWT_SECRET=$JWT_SECRET
REFRESH_SECRET=$REFRESH_SECRET
APP_URL=http://$DROPLET_IP
SHORT_URL_BASE=http://$DROPLET_IP
ENV

echo "✓ Environment variables generated"

echo ""
echo "Step 4: Deploying application..."

# Copy files to droplet
scp /tmp/.env.prod root@$DROPLET_IP:/app/.env

# SSH and deploy
ssh root@$DROPLET_IP << 'REMOTE'
cd /app

# Pull latest images
doctl registry login
docker-compose -f docker-compose.prod.yml pull

# Stop existing containers
docker-compose -f docker-compose.prod.yml down

# Start containers
docker-compose -f docker-compose.prod.yml up -d

# Wait for services
sleep 10

# Run migrations
docker-compose -f docker-compose.prod.yml run --rm migrations

# Check status
docker-compose -f docker-compose.prod.yml ps

echo "✓ Deployment completed!"
REMOTE

echo ""
echo "========================================="
echo "✓ DEPLOYMENT SUCCESSFUL!"
echo "========================================="
echo ""
echo "Your application is running at:"
echo "  http://$DROPLET_IP"
echo ""
echo "API Endpoints:"
echo "  Health: http://$DROPLET_IP/health"
echo "  Auth:   http://$DROPLET_IP/api/auth"
echo "  Links:  http://$DROPLET_IP/api/links"
echo ""
echo "To view logs:"
echo "  ssh root@$DROPLET_IP 'cd /app && docker-compose -f docker-compose.prod.yml logs -f'"
echo ""
echo "To stop the application:"
echo "  ssh root@$DROPLET_IP 'cd /app && docker-compose -f docker-compose.prod.yml down'"
echo ""
echo "SAVE THESE CREDENTIALS:"
echo "  Droplet IP: $DROPLET_IP"
echo "  Postgres Password: $POSTGRES_PASSWORD"
echo "  Redis Password: $REDIS_PASSWORD"
echo ""

# Clean up
rm /tmp/.env.prod

#!/bin/bash

set -e

# Configuration
REGISTRY="registry.digitalocean.com/shortlink-registry"
IMAGE_NAME="shortlink-api"
VERSION=${1:-latest}

echo "Building Docker image..."
docker build -t $IMAGE_NAME:$VERSION .

echo "Tagging image for registry..."
docker tag $IMAGE_NAME:$VERSION $REGISTRY/$IMAGE_NAME:$VERSION
docker tag $IMAGE_NAME:$VERSION $REGISTRY/$IMAGE_NAME:latest

echo "Logging into DigitalOcean registry..."
doctl registry login

echo "Pushing image to registry..."
docker push $REGISTRY/$IMAGE_NAME:$VERSION
docker push $REGISTRY/$IMAGE_NAME:latest

echo "✓ Build and push completed successfully!"
echo "Image: $REGISTRY/$IMAGE_NAME:$VERSION"

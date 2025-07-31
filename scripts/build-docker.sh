#!/bin/bash

# Build script for GitHub Stats MCP Server Docker image

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐳 Building GitHub Stats MCP Server Docker image...${NC}"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
IMAGE_NAME="github-stats-mcp"
IMAGE_TAG="${IMAGE_NAME}:${VERSION}"
LATEST_TAG="${IMAGE_NAME}:latest"

echo -e "${YELLOW}📦 Version: ${VERSION}${NC}"

# Build the Docker image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
docker build -t "$IMAGE_TAG" -t "$LATEST_TAG" .

# Show image size
echo -e "${GREEN}✅ Build completed successfully!${NC}"
echo -e "${YELLOW}📊 Image details:${NC}"
docker images "$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo -e "${GREEN}🚀 Ready for deployment!${NC}"
echo -e "To run locally: ${YELLOW}docker run --env-file .env $LATEST_TAG${NC}"
echo -e "To push to registry: ${YELLOW}docker push $IMAGE_TAG${NC}"
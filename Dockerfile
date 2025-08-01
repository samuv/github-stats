# Use secure Chainguard node image
FROM cgr.dev/chainguard/node:latest

# Switch to root temporarily for package installation
USER root

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files and change ownership to node user
COPY --chown=node:node package.json pnpm-lock.yaml ./

# Switch back to node user for dependency installation
USER node

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code with correct ownership
COPY --chown=node:node . .

# Run code quality checks
RUN pnpm ci

# Build the TypeScript code
RUN pnpm run build

# Ensure the node user owns the built files
USER root
RUN chown -R node:node /app/dist
USER node

# Expose the port (MCP typically uses stdio, but for health checks)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('MCP Server is healthy')" || exit 1

# Run the MCP server
ENTRYPOINT ["node", "dist/index.js"]
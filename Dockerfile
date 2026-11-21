# Ultra-lightweight Node.js container
FROM node:24-alpine AS base
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable

# Install dependencies
COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN pnpm install --frozen-lockfile --prod

# Copy application source
COPY src/ ./src/

# Run the daily claim
CMD ["node", "src/index.ts"]

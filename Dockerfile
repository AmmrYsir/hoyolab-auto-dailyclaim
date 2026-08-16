# Ultra-lightweight Bun container (~80MB)
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile --production

# Copy application source
COPY src/ ./src/

# Run the daily claim
CMD ["bun", "run", "src/index.ts"]

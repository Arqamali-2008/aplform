# syntax=docker/dockerfile:1.7
# Multi-stage image for Fly.io / any container host.
# Cloudflare Workers is the default target (via nitro); for Fly we override the
# nitro preset to node-server so we get a Node HTTP server we can run in a container.

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* bunfig.toml ./
RUN bun install --frozen-lockfile || bun install

FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NITRO_PRESET=node-server
RUN bun run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
COPY --from=build /app/.output ./.output
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]

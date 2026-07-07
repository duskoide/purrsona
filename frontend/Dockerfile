FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# ---- Local development (docker-compose target: dev) ----
# Runs `next dev` with source bind-mounted for hot reload. Not suitable
# for production: unminified, includes dev-only tooling, higher memory use.
FROM deps AS dev
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- Production build ----
FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run build

# ---- Production runtime (ECS/Fargate target: production) ----
# Uses Next.js's `output: "standalone"` bundle: a minimal self-contained
# server with only the node_modules it actually needs at runtime.
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
# next.js standalone's server.js binds to the HOSTNAME env var if set, and
# otherwise can resolve to a container-internal address that isn't
# reachable from outside — pin it to 0.0.0.0 explicitly.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]

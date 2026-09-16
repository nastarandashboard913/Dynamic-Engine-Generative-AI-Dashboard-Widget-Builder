# syntax=docker/dockerfile:1

# ---- deps ------------------------------------------------------------------
# Cached separately from source so editing a .ts file does not reinstall
# node_modules on every rebuild.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# tsx is required at runtime (the server is executed as TypeScript, never
# compiled), so devDependencies are intentionally included here.
RUN npm ci

# ---- runtime ---------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

# Run unprivileged. The `node` user ships with the base image.
USER node

EXPOSE 8787
CMD ["npx", "tsx", "src/index.ts"]

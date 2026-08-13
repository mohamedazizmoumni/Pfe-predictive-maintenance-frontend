# Angular 17 Universal (SSR) admin dashboard. Two-stage build: compile with
# full devDependencies, then run with only the production deps the Express
# SSR server (server.ts -> dist/pfe-front/server/server.mjs) actually needs
# at runtime (express, @angular/ssr, @angular/platform-server, etc. are all
# regular "dependencies" in package.json, not dev-only).

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:${PORT}/ || exit 1

CMD ["node", "dist/pfe-front/server/server.mjs"]

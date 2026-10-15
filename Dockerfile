FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS builder

WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run prepare
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts

# ─── Runtime Stage ───────────────────────────────────────────
FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS runtime

WORKDIR /app

# Native addon dependencies (better-sqlite3) + su-exec for permission fix at startup
# Package managers are build tools; the deployed app starts with node directly.
# Removing them also avoids shipping their independent dependency trees.
RUN apk add --no-cache sqlite-libs su-exec \
    && rm -rf /usr/local/lib/node_modules/npm /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/lib/db/migrations ./src/lib/db/migrations
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts/start-server.mjs ./scripts/start-server.mjs
COPY --from=builder /app/scripts/runtime-origin.mjs ./scripts/runtime-origin.mjs
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /app/data

EXPOSE 3000
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=/app/data/groly.db

HEALTHCHECK --interval=30s --timeout=5s --start-period=10m --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]

FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS node-base

FROM node-base AS builder

WORKDIR /app
COPY package*.json ./
COPY vendor ./vendor
RUN npm ci --ignore-scripts

COPY . .
RUN npm run prepare
RUN npm run build
RUN npm prune --omit=dev --omit=optional --ignore-scripts \
    && find node_modules/better-sqlite3/prebuilds -type f ! -name "linuxmusl-$(node -p process.arch).node" -delete \
    && rm -rf node_modules/better-sqlite3/deps node_modules/better-sqlite3/src node_modules/better-sqlite3/binding.gyp \
    && node -e "const Database=require('better-sqlite3'); const db=new Database(':memory:'); if(db.prepare('SELECT 1 AS ok').get().ok!==1) process.exit(1); db.close();"

# ─── Runtime Stage ───────────────────────────────────────────
FROM alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS runtime

WORKDIR /app

# Copy only the verified Node runtime, so package managers and SDK headers never
# enter a shipped image layer. SQLite 13 embeds SQLite in its native addon.
RUN apk add --no-cache --upgrade libcrypto3=3.5.9-r1 libssl3=3.5.9-r1 zlib=1.4-r0 libstdc++ libgcc libatomic su-exec \
    && addgroup -g 1000 node \
    && adduser -u 1000 -G node -s /bin/sh -D node
COPY --from=node-base /usr/local/bin/node /usr/local/bin/node
COPY --from=node-base /usr/local/LICENSE /usr/local/share/licenses/node/LICENSE
RUN ln -s node /usr/local/bin/nodejs

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
# Runtime migrations use SQL files and the journal, not Drizzle Kit's snapshots.
COPY --from=builder /app/src/lib/db/migrations/*.sql ./src/lib/db/migrations/
COPY --from=builder /app/src/lib/db/migrations/meta/_journal.json ./src/lib/db/migrations/meta/_journal.json
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

HEALTHCHECK --interval=30s --timeout=5s --start-period=10m --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1

ENTRYPOINT ["/entrypoint.sh"]

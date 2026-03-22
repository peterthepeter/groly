FROM node:22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide
RUN npm run build

# ─── Runtime Stage ───────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Native addon dependencies (better-sqlite3)
RUN apk add --no-cache python3 make g++ sqlite-libs

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/lib/db/migrations ./src/lib/db/migrations
COPY --from=builder /app/package.json ./package.json

# Datenverzeichnis
RUN mkdir -p /app/data

EXPOSE 3000
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=/app/data/groly.db

CMD ["node", "build"]

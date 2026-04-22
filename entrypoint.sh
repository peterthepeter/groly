#!/bin/sh
chown -R node:node /app/data 2>/dev/null || true
exec su-exec node node build

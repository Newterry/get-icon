FROM node:20-alpine AS build

ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm config set registry "$NPM_REGISTRY" && \
    npm_config_maxsockets=50 npm ci --ignore-scripts --no-audit --no-fund \
      --fetch-retries=5 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=10000

COPY frontend ./frontend
COPY backend ./backend
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runtime

LABEL org.opencontainers.image.title="Get Icon" \
      org.opencontainers.image.description="Extract, inspect, convert and download the best icon from any public website." \
      org.opencontainers.image.source="https://github.com/Newterry/get-icon" \
      org.opencontainers.image.url="https://github.com/Newterry/get-icon" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps \
    PORT=3080 \
    TZ=Asia/Shanghai

WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/backend/dist ./backend/dist

USER node
EXPOSE 3080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3080) + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["npm", "start"]

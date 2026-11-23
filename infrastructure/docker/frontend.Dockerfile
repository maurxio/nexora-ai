FROM node:26-trixie-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/workflow-engine/package.json packages/workflow-engine/package.json
COPY workers/document-worker/package.json workers/document-worker/package.json
COPY workers/notification-worker/package.json workers/notification-worker/package.json
COPY workers/workflow-worker/package.json workers/workflow-worker/package.json
RUN npm ci --ignore-scripts --workspace apps/web
COPY apps/web apps/web
RUN npm run build -w apps/web
FROM nginxinc/nginx-unprivileged:stable-alpine
USER root
RUN apk upgrade --no-cache
COPY infrastructure/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/nginx-health || exit 1

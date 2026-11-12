FROM node:24-alpine AS dependencies
RUN apk upgrade --no-cache && apk add --no-cache openssl ca-certificates
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/workflow-engine/package.json packages/workflow-engine/package.json
COPY workers/document-worker/package.json workers/document-worker/package.json
COPY workers/notification-worker/package.json workers/notification-worker/package.json
COPY workers/workflow-worker/package.json workers/workflow-worker/package.json
RUN npm ci --omit=dev --ignore-scripts --include-workspace-root --workspace apps/api --workspace workers/workflow-worker --workspace workers/notification-worker --workspace workers/document-worker --workspace packages/shared --workspace packages/workflow-engine
COPY apps/api/prisma apps/api/prisma
RUN npm run db:generate

FROM node:24-alpine AS runtime
RUN apk upgrade --no-cache && apk add --no-cache openssl ca-certificates
WORKDIR /app
ENV NODE_ENV=production
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=dependencies /app /app
COPY apps/api/src apps/api/src
COPY packages/shared/src packages/shared/src
COPY packages/workflow-engine/src packages/workflow-engine/src
COPY workers workers
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/api/src/server.js"]

FROM runtime AS workflow-worker
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD node -e "const fs=require('fs');if(Date.now()-fs.statSync('/tmp/nexora-worker-health').mtimeMs>30000)process.exit(1)"
CMD ["node", "workers/workflow-worker/src/index.js"]

FROM runtime AS notification-worker
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD node -e "const fs=require('fs');if(Date.now()-fs.statSync('/tmp/nexora-worker-health').mtimeMs>30000)process.exit(1)"
CMD ["node", "workers/notification-worker/src/index.js"]

FROM runtime AS document-worker
ENV OCR_LANG_PATH=/usr/share/tessdata
USER root
RUN apk upgrade --no-cache && apk add --no-cache poppler-utils tesseract-ocr-data-spa tesseract-ocr-data-eng
USER node
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD node -e "const fs=require('fs');if(Date.now()-fs.statSync('/tmp/nexora-worker-health').mtimeMs>30000)process.exit(1)"
CMD ["node", "workers/document-worker/src/index.js"]

FROM document-worker AS final

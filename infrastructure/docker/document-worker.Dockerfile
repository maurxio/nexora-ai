FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-spa tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY workers/document-worker/package*.json workers/document-worker/
COPY packages/shared/package*.json packages/shared/
RUN npm ci
COPY . .
CMD ["node", "--env-file=.env", "workers/document-worker/src/index.js"]

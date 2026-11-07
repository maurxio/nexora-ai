# NEXORA AI

Backend base de NEXORA AI, una API SaaS multiempresa con Express, Prisma y PostgreSQL.

## Arranque

Requisitos: Node.js 20.6+, Docker y Docker Compose.

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:generate
npm run db:migrate -- --name init
npm run dev:api
```

Comprobar el servicio:

```bash
curl http://localhost:3000/api/v1/health
```

La API queda disponible en `http://localhost:3000/api/v1`.

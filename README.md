# NEXORA AI

Backend base de NEXORA AI, una API SaaS multiempresa con Express, Prisma y PostgreSQL.

## Arranque

Requisitos: Node.js 22.13+ (recomendado 24), Docker y Docker Compose.

```bash
npm ci
cp .env.example .env
# Completar JWT_SECRET, AI_KEY_ENCRYPTION_SECRET e INTEGRATIONS_ENCRYPTION_KEY
# según los comandos de .env.example antes de arrancar.
npm run dev
```

`npm run dev` inicia PostgreSQL y Redis con Docker, genera el cliente Prisma,
aplica las migraciones y levanta la API y la interfaz en paralelo.

La interfaz queda disponible en `http://localhost:5173`.

Comprobar el servicio:

```bash
curl http://localhost:3000/api/v1/health
```

La API queda disponible en `http://localhost:3000/api/v1`.

Para ejecutar workflows, inicia la API y el worker en terminales separadas:

```bash
npm run dev:api
npm run dev:worker
```

## Constructor visual de workflows

En `Workflows > [workflow]` los usuarios `ADMIN` y `OPERATOR` pueden construir el
flujo con la paleta visual: arrastra o selecciona un nodo, conéctalo de izquierda
a derecha y configúralo en el panel lateral. El editor guarda internamente la
misma definición `nodes/edges` que consume la API; el usuario final no necesita
editar JSON. `AUDITOR` puede consultar el diagrama y las versiones publicadas,
pero no modificarlo.

Antes de publicar usa **Validar workflow**. El botón **Probar workflow** crea una
ejecución de la última versión publicada y muestra el estado de sus pasos.
Las versiones publicadas son inmutables; los cambios se realizan siempre sobre
el borrador.

## Calidad, pruebas y despliegue

```sh
npm ci
npm run db:generate
npm run test:db:up
npm run lint && npm test && npm run build
npm run format:check
npm run test:coverage
npm run test:handles
npx playwright install --with-deps chromium
npm run test:e2e
npm run test:db:down
```

Los tests usan PostgreSQL/Redis efímeros independientes de `.env` y migraciones reales.
CI verifica Node 22/24, cobertura, frontend y backend; Security audita dependencias,
secretos e imágenes. Release publica cinco imágenes GHCR por SHA/semver y despliega
staging; producción requiere el environment protegido con aprobación configurada.

La estrategia principal usa VPS + Docker Compose + Caddy/TLS. Antes del primer
arranque configura secretos y dominio siguiendo [DEPLOYMENT](docs/DEPLOYMENT.md).
Consulta [TESTING](docs/TESTING.md), [RUNBOOK](docs/RUNBOOK.md),
[checklist de producción](docs/PRODUCTION_CHECKLIST.md) y [entrega/verificación](docs/DELIVERY.md).
Existen stubs de negocio descritos en el runbook que deben resolverse o deshabilitarse
antes de ofrecer esas funciones en producción.

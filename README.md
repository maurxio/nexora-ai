# NEXORA AI

Backend base de NEXORA AI, una API SaaS multiempresa con Express, Prisma y PostgreSQL.

## Arranque

Requisitos: Node.js 20.6+, Docker y Docker Compose.

```bash
npm install
cp .env.example .env
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

# Entrega: pruebas, CI/CD y despliegue

Fecha de verificación: 2026-11-12. Cambios en commits Conventional Commits. Las modificaciones previas del usuario en tema/interfaz permanecen fuera de estos commits; solo se incorpora formato del código original y la extracción propia de ProtectedRoute.

## 1. Pruebas y correcciones

Archivos: rutas/servicios y validadores de los módulos API, middleware RBAC, motor, entrypoints de workers; `test/env.js`, `apps/api/test/*`, `apps/web/test/*`, `packages/workflow-engine/test/engine.test.js`, `docker-compose.test.yml`, `apps/web/vitest.config.js`, `playwright.config.js`, `scripts/test-{db,handles}.js`, `apps/web/src/auth/ProtectedRoute.jsx`.

Se conservó node:test en API/motor; se incorporaron Supertest, Vitest/RTL y Playwright. Postgres/Redis son efímeros e independientes de desarrollo, con migraciones reales y fixtures eliminados por ID. Casos de login/JWT/refresh, todos los métodos de los módulos críticos con orgId ajeno, roles AUDITOR, IDs ajenos con membresías en ambas organizaciones, aprobaciones/notificaciones, HTTP/webhooks/reintentos, OCR mock, proveedor IA mock y worker real.

Se corrigen cierre de las siete colas/Redis/Prisma, RBAC de escrituras, privilegios OWNER, carrera al rotar refresh tokens, estado residual de reintentos HTTP, serialización de proveedor IA, versión de ejecución omitida por clave duplicada y cancelación previa en motor. La conexión BullMQ ahora respeta índice de Redis, usuario y TLS del URL. Los tests HTTP mockean fetch/DNS y no dependen de servicios externos.

Verificar:

```sh
npm run test:db:up
npm test
npm run test:handles
npm run test:coverage
npx playwright install --with-deps chromium
npm run test:e2e
```

Resultado en checkout limpio con Node 24.22.3 y sin .env: 165 tests unitarios/integración y un smoke E2E pasan; lint, formato y build también pasan. El backend sale sin forceExit. Cobertura: backend con workers 81,39% de líneas, frontend 66,43% de líneas (63,91% en el árbol que conserva los cambios previos del usuario). Cobertura mínima exigida: backend 70% líneas/sentencias y 55% ramas/funciones, incluyendo workers; frontend 60% líneas/sentencias y 50% ramas/funciones. Los reportes cuentan todos los módulos de negocio, con exclusiones limitadas a entrypoints descritas en TESTING.md.

## 2. Calidad estática y dependencias

Archivos: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.husky/*`, `commitlint.config.cjs`, `package*.json` y manifests de workspaces. Formato compartido en el monorepo. Hooks lint-staged y Conventional Commits. Dependencias vulnerables actualizadas, incluidos Zod 4 y compatibilidad de records/PATCH; override de deepmerge-ts validado con generación y migraciones Prisma 6.

```sh
npm run lint
npm run format:check
npm audit --audit-level=high
```

Resultado: lint/formato pasan; npm audit no reporta HIGH/CRITICAL. Persisten 10 avisos moderados al verificar; el umbral elegido los reporta sin bloquear. Los commits se prepararon desde el índice para no incorporar cambios previos del usuario; sus mensajes se validaron con commitlint y los checks se ejecutaron manualmente.

## 3. CI/CD y seguridad

Archivos: `.github/workflows/{ci,security,release,deploy}.yml`, `.github/dependabot.yml`, `.gitleaksignore`.

CI paralelo con Node 22/24, cache npm, servicios DB/Redis, lint/formato, suites, cobertura, build, smoke y ensayo backup/restore. Security: auditoría, Gitleaks de historial y Trivy sobre las cinco imágenes. Release exige éxito de CI y Security para el SHA; publica SHA completo y semver en GHCR y despliega staging. Producción se solicita con un SHA ya verificado y depende de reviewers configurados en el environment.

```sh
docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.7
docker run --rm -v "$PWD:/repo:ro" zricethezav/gitleaks:v8.24.3 detect --source=/repo --gitleaks-ignore-path=/repo/.gitleaksignore --redact
```

Resultado: workflows validados con actionlint/ShellCheck y Gitleaks sin hallazgos no exceptuados. Hay un solo fingerprint exceptuado para el JWT público y determinista de test/env.js; no se ignoran directorios completos. La ejecución remota de Actions, publicación GHCR y aprobación de environments requiere configuración de la cuenta y no se ha realizado desde esta sesión.

## 4. Contenedores y operación

Archivos: `infrastructure/docker/*`, `infrastructure/nginx/default.conf`, `infrastructure/caddy/Caddyfile`, `.dockerignore`, `docker-compose.prod.yml`, `.env.example`, `apps/api/src/config/*`, `apps/api/src/infrastructure/{shutdown,worker-health}.js`, entrypoints API/workers y `scripts/{deploy,backup,restore,verify-backup}.sh`.

Cinco imágenes multi-stage verificadas. API/workers ejecutan como UID 1000 y frontend como UID 101. Nginx aporta gzip, CSP, cabeceras, proxy `/api` y SPA; Caddy gestiona TLS. Postgres/Redis no exponen puertos y persisten datos. Validación Zod al arrancar; secretos, límites numéricos, orígenes HTTPS y política de hosts privados. Healthchecks, readiness DB/Redis y apagado con plazo.

```sh
docker build -f infrastructure/docker/api.Dockerfile --target api -t nexora-local/api:test .
# Repetir con targets workflow-worker, notification-worker y document-worker.
docker build -f infrastructure/docker/frontend.Dockerfile -t nexora-local/frontend:test .
bash scripts/verify-backup.sh
```

Resultado: cinco imágenes compilan. Compose aislado con NODE_ENV=production aplicó diez migraciones, levantó todos los servicios de aplicación healthy, verificó readiness, proxy API, fallback SPA y CSP. API y los tres workers respondieron a SIGTERM con exit 0. Dump/restore real recuperó diez migraciones y un dato de prueba en base nueva, eliminada después. No se tocó la DB de desarrollo. Certificados públicos/TLS necesitan DNS y un VPS accesible.

## 5. Documentación y tareas manuales

Archivos: `README.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`, `docs/PRODUCTION_CHECKLIST.md` y este informe. Incluyen setup, estrategia VPS en cinco líneas, alternativas gestionadas, rollback, rotación y recuperación.

Pasos manuales exactos están en DEPLOYMENT.md:

1. Provisionar VPS de staging/producción y configurar DNS/puertos 80/443.
2. Configurar environments GitHub, reviewers de producción, protección de main y secretos DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS.
3. Clonar en `/opt/nexora`, crear entorno privado, generar claves/contraseñas independientes, configurar URLs internas, SMTP y acceso GHCR de lectura.
4. Publicar los commits mediante el flujo de revisión del repositorio; esperar CI + Security + imágenes + staging.
5. Ejecutar primer despliegue según DEPLOYMENT.md; validar staging y solicitar Deploy a production con el SHA verificado.
6. Instalar cron de backups, copia externa cifrada de DB/uploads/claves, alertas y ensayo de restore/rollback.

## Límites que impiden declarar producción completa

- Stubs existentes: resumeWorkflow, nodo approval no implementado y agent /run 501. Resolverlos o deshabilitarlos antes de ofrecer esas funciones.
- Timeout real de OCR e idempotencia ante procesos interrumpidos requieren trabajo de negocio adicional.
- Auditoría best-effort y rotación con recifrado de credenciales necesitan decisión/implementación si los requisitos lo exigen.
- No se ha publicado infraestructura remota ni probado carga/alta disponibilidad, DNS o recuperación del futuro VPS.
- Security/Trivy debe quedar verde en GitHub antes de permitir release. No se relaja la puerta por limitaciones del entorno local.

La infraestructura y las verificaciones locales no sustituyen estos requisitos operativos.

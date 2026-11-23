# Pruebas

`npm ci` genera automáticamente Prisma mediante postinstall, sin migrar ni tocar datos. Se conserva `node:test` en API/motor y se usa Vitest + React Testing Library en web. JavaScript sin TypeScript. Node 22.13+ y 24 se comprueban en CI; se recomienda Node 24.

```sh
npm ci
npm run db:generate
npm run test:db:up
npm run lint && npm test && npm run build
npm run test:coverage
npm run test:handles
npx playwright install --with-deps chromium
npm run test:e2e
npm run test:db:down
```

`test:db:up` inicia Postgres/Redis efímeros en 55433/56380 y aplica las diez migraciones con `migrate deploy`. No usa los servicios de desarrollo. `test/env.js` no importa `.env`: fuerza DATABASE_URL desde TEST_DATABASE_URL, nombre terminado en `_test`; Redis exige base 1. Las colas respetan el índice de base Redis y TLS del URL. CI proporciona sus propios servicios en 5432/6379. Nunca apuntar estas variables a datos reales.

`test:unit`: servicios puros, Zod, crypto, SSRF, motor, componentes, navegación protegida, cliente HTTP y sesiones. `test:integration`: Supertest contra Express y Prisma/Postgres reales, membresías, roles, aprobaciones/notificaciones, CRUD de workflows/agentes/conectores, webhooks firmados y rotación, OCR mockeado y proveedor IA mock. El workflow-worker se arranca como proceso real con un grafo trigger → agente mock → transform, verifica resultado/uso IA y se detiene con SIGTERM. BullMQ también se verifica con un worker efímero que falla una vez y se recupera. Ninguna prueba llama proveedores IA reales.

Los fixtures usan UUID y eliminan organizaciones/usuarios por ID al terminar; las relaciones se eliminan en cascada. No hay truncado global ni dependencia entre archivos. Cada caso que crea recursos propios los elimina o los deja dentro del fixture de su archivo, que se destruye en `after`. Playwright elimina exclusivamente sus usuarios `e2e-` y sus organizaciones en globalTeardown. Reconstruir servicios efímeros entre corridas para borrar caché y jobs pendientes.

La matriz de seguridad verifica cada método publicado de los módulos críticos frente a `orgId` ajeno, más AUDITOR sin escritura; los workflows prueban además ID ajeno con membresía en ambos tenants. Los módulos sin operación DELETE (aprobaciones/observabilidad) comprueban sus operaciones reales, sin inventar endpoints.

Cobertura: c8 incluye **todos** los archivos API/motor/workers, salvo entrypoint HTTP y bootstrap; mínimo 70% líneas/sentencias, 55% funciones/ramas. Web incluye todo `src`, salvo montaje `main.jsx`; mínimo 60% líneas/sentencias, 50% ramas y 50% funciones. El editor visual completo y los workers siguen siendo áreas a ampliar. No se excluyen módulos de negocio para alcanzar el umbral. Reportes en `coverage/lcov.info` y `apps/web/coverage/lcov.info`.

Todos los procesos deben terminar por sí mismos: no hay `--forceExit`. El teardown cierra las siete queues, worker/QueueEvents, Redis, Prisma y timers. `test:handles` impone un plazo de 120 segundos y falla si el backend no sale; `--test-timeout=30000` acota cada archivo. Un bloqueo requiere revisar sockets/timers, nunca desactivar la detección. Esto es detección por salida del proceso, no un inventario exhaustivo de handles.

El smoke usa puertos 3101 y 5179 para no interferir con desarrollo. Hace registro de fixture por API, login en navegador, dashboard y creación de workflow. La navegación protegida se verifica con RTL. En CI se guardan trazas solo al fallar.

Convenciones: `*.unit.test.js` para backend puro, `*.integration.test.js` para infraestructura, `*.test.jsx`/`*.test.js` para web; mocks restaurados en finally/teardown; no secretos ni snapshots de datos reales. Husky ejecuta lint-staged; commitlint exige Conventional Commits. Los umbrales y `npm audit --audit-level=high` bloquean CI.

Gitleaks conserva un único fingerprint en `.gitleaksignore` para el JWT determinista de `test/env.js` introducido en el commit indicado. Es una credencial pública de pruebas, no se copia a las imágenes ni se permite un ignore general del directorio de tests. La excepción es por commit/ruta/línea/regla; cualquier hallazgo nuevo debe revisarse.

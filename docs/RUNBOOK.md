# Runbook

Usar `docker compose --env-file .env.production -f docker-compose.prod.yml` (abreviado `compose` abajo). No mostrar variables/secretos en reportes. Recoger requestId, hora UTC, SHA y tenant afectado. Escalar según el impacto.

## API caída o no lista

`compose ps`, `compose logs --tail=100 api`. `/health` solo comprueba proceso; `/ready` comprueba Postgres y Redis, responde 503 si fallan. `/metrics` requiere Bearer METRICS_TOKEN y solo es accesible en red interna. Si hay fallo de configuración, corregir entorno y recrear API/workers. Si empezó tras release y DB es compatible, aplicar rollback documentado. No reiniciar repetidamente sin conservar evidencia.

## Postgres caído

Comprobar `compose logs --tail=100 postgres`, espacio de disco y volumen persistente. `compose exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`. Restaurar conectividad/espacio antes de reiniciar. Nunca usar `down -v`. Si datos dañados, parar escrituras y restaurar en base nueva con `scripts/restore.sh`; validar migraciones/conteos y cambiar URL coordinadamente. Escalar pérdida de datos y medir RPO/RTO.

## Redis caído

Comprobar logs, disco, autenticación, red y estado AOF. El volumen persiste jobs; política `noeviction` evita descartarlos silenciosamente. Readiness fallará y escrituras que encolan pueden fallar parcialmente: revisar registros de ejecución/documento antes de reintentar. Recuperar Redis y reiniciar workers si no reconectan. No hacer FLUSHALL/FLUSHDB. La cache de analítica es prescindible, la cola no.

## Cola atascada

Identificar `workflow-executions` (confirmar valor QUEUE_NAME en packages/shared), `approvals`, `workflow-resume`, `notification-email`, `webhook-inbound`, `webhook-outbound` o `document-processing`. Ver profundidad waiting/active/failed/delayed en métricas y logs del worker correspondiente. Healthcheck de worker mide ejecución y ping Redis; no garantiza progreso de cada job. Inspeccionar fallo original, attempts y lease antes de reintentar: reintentos pueden repetir efectos externos. Reiniciar un worker con SIGTERM drena sus jobs dentro del plazo de 25 s; Compose espera 30 s. Jobs OCR largos pueden superar ese plazo y recuperarse como stalled: comprobar idempotencia. No borrar jobs para ocultar errores. La recuperación de workflows usa leases; no editar estados manualmente sin análisis.

## Limitaciones de negocio conocidas

`resumeWorkflow` sigue siendo stub; los nodos approval del motor rechazan ejecución y el endpoint agente `/run` responde 501. Las notificaciones sin SMTP se escriben en consola. DOCUMENT_JOB_TIMEOUT_MS es una opción heredada que BullMQ no hace cumplir. Resolver o deshabilitar explícitamente esas funciones antes de ofrecerlas en producción. El audit logger es best-effort y no garantiza durabilidad; requisitos de auditoría estrictos requieren outbox/registro transaccional.

## Operación preventiva

Alertar por 503 de readiness, workers unhealthy, jobs failed/estancados, disco, backup ausente, errores de migración y expiración TLS. Programar backup diario, copia cifrada externa y restore mensual. Revisar Dependabot y Security semanalmente, incluyendo vulnerabilidades moderadas. No se ha aprovisionado monitorización remota ni alertas. Registrar responsables y contactos antes de la puesta en producción.

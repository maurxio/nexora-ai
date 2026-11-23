# Despliegue

## Estrategia principal

VPS Linux con Docker Compose y Caddy.
Permite compartir el volumen de documentos entre API y OCR sin almacenamiento nuevo.
Aísla Postgres y Redis sin publicar sus puertos.
Versiona API, tres workers y frontend con el mismo SHA.
Es simple de operar, pero requiere backups externos, monitorización y mantenimiento del host.

Las imágenes de aplicación usan Node 24 sobre Alpine, con paquetes actualizados y modelos OCR locales; npm/Corepack no se incluyen en runtime. Prisma documenta [compatibilidad con musl en v6](https://www.prisma.io/docs/orm/v6/reference/system-requirements). Se verifican el motor nativo de Prisma, sharp y OCR real antes de adoptar la imagen. Las migraciones ejecutan el CLI local de Prisma directamente con Node.

## Preparación manual

1. Crear un VPS para staging y otro para producción, con Docker Engine/Compose v2, Git, Bash y `flock`. Estimar RAM para OCR y probar con carga; no hay alta disponibilidad en un único VPS. Abrir 80/443 y restringir SSH a administración/CI según la política de red.
2. Crear registro DNS A (y AAAA solo si funciona IPv6) de cada dominio al VPS. Caddy obtiene TLS automáticamente. No publicar Postgres, Redis ni API.
3. Clonar en `/opt/nexora`. Crear `.env.production` en producción o `.env.staging` en staging desde `.env.example`, permisos 600. No copiar `.env` de desarrollo. Para staging, exportar `APP_ENV_FILE=.env.staging` también en el servicio SSH o usar `.env.production` como nombre local con `NODE_ENV=staging`.
4. Generar JWT_SECRET, AI_KEY_ENCRYPTION_SECRET y METRICS_TOKEN **independientes** con `openssl rand -hex 32`. INTEGRATIONS_ENCRYPTION_KEY con `openssl rand -base64 32`. Generar contraseñas DB/Redis independientes. Codificar caracteres especiales al usarlas en URLs; no imprimir secretos en logs.
5. Configurar NODE_ENV=production (o staging), DOMAIN, IMAGE_PREFIX en minúsculas, IMAGE_TAG=SHA verificado; DATABASE_URL=`postgresql://nexora:CONTRASEÑA_CODIFICADA@postgres:5432/nexora?connect_timeout=5&pool_timeout=5`, REDIS_URL=`redis://:CONTRASEÑA_CODIFICADA@redis:6379/0`, CORS_ORIGINS=`https://DOMINIO`, TRUST_PROXY_HOPS=2, DOCUMENT_STORAGE_PATH=/data/uploads. Mantener HTTP_NODE_ALLOW_LOOPBACK=false y ALLOW_PRIVATE_HOSTS=false. SMTP_* y MAIL_FROM necesitan credenciales reales para entregar correo.
6. Si GHCR es privado, autenticar el usuario del VPS con token de lectura `read:packages` vía `docker login ghcr.io --password-stdin`. Dar acceso al repositorio para `git fetch`, sin credenciales de escritura innecesarias.
7. En GitHub, crear environments **staging** y **production**. En production activar required reviewers, prevent self-review y limitar ramas de despliegue a main. Esto se configura en GitHub, YAML no puede imponer reviewers. Proteger main y exigir CI/seguridad. Guardar en cada environment DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY y DEPLOY_KNOWN_HOSTS (huella verificada por un canal confiable). Los secretos de aplicación permanecen en el VPS o en el gestor de secretos elegido; nunca en Git.
8. El usuario SSH requiere acceso Docker y escritura en `/opt/nexora`; acceso Docker equivale a privilegios de host. Restringir cuenta, clave y administradores de environments.

## Primer despliegue y siguientes

```sh
cd /opt/nexora
chmod 600 .env.production
# Primero debe existir el conjunto de imágenes de este SHA en GHCR.
export IMAGE_TAG=SHA_COMPLETO_VERIFICADO
bash scripts/deploy.sh
```

El script valida Compose, descarga imágenes, levanta DB/Redis, hace backup si existe esquema, ejecuta **una sola** tarea `prisma migrate deploy` y espera healthchecks. No usa `migrate dev` ni `db push`. Una migración fallida detiene el despliegue. Hay un lock del host para evitar despliegues simultáneos. Compose recrea servicios y puede haber indisponibilidad breve; no promete zero downtime. Revisar `/health` interno, `/ready` interno y `https://DOMINIO/api/v1/health` público. Revisar logs y ejecutar smoke de negocio en staging.

`ci.yml` se ejecuta en PR/push main. `release.yml` solo construye/publica tras CI y Security exitosos para un SHA de main (o una release publicada con CI exitoso). Publica cada imagen con SHA completo y semver para releases `vX.Y.Z`. Staging automático al terminar las imágenes. Producción: ejecutar workflow **Deploy** con environment `production` e image_tag del SHA ya probado; el environment debe exigir aprobación. Release espera también el resultado exitoso de Security; exigir sus checks mediante reglas de protección; revisar también los escaneos programados. No ejecutar Release con código de un fork no confiable.

## Backups y restauración

```sh
# Probar manualmente antes de programar:
bash scripts/backup.sh
bash scripts/restore.sh backups/postgres-FECHA.dump nexora_restore
```

El backup es pg_dump custom, permisos privados, escritura temporal y retención local de 14 días. Restore solo crea bases nuevas terminadas en `_restore`, nunca sobrescribe la base viva, y verifica la tabla de migraciones. Validar además usuarios y conteos de datos de negocio. El dump de DB **no incluye documentos**, Redis ni claves: respaldar volumen `uploads` y claves cifradas en destino externo protegido. Copiar dumps fuera del VPS con cifrado y alertar si fallan o envejecen. Objetivos iniciales por confirmar: RPO 24 h, RTO 2 h; medirlos en staging.

Cron sugerido para el usuario de despliegue, con alertas y log protegido:

```cron
15 3 * * * cd /opt/nexora && bash scripts/backup.sh >> /var/log/nexora-backup.log 2>&1
```

No se instala cron ni se configura copia externa automáticamente. Ensayar restore periódicamente y eliminar las bases de ensayo tras validación. La verificación automatizada de dump/restore usa Postgres efímero; no acredita la recuperación de tu futuro VPS.

## Rollback

1. Registrar SHA anterior y backup antes del despliegue. Detener escrituras si la versión nueva corrompe datos.
2. Si el esquema sigue siendo compatible, exportar IMAGE_TAG=SHA_ANTERIOR y usar `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --wait api workflow-worker notification-worker document-worker frontend`. No cambiar a código con migraciones antiguas y ejecutar migraciones a ciegas.
3. Si el esquema es incompatible, restaurar dump a una base nueva `_restore`, validar y cambiar DATABASE_URL/POSTGRES_DB de manera coordinada con el SHA compatible; conservar la base fallida para análisis. Tener en cuenta pérdida de escrituras posteriores al backup.
4. Migraciones forward-only con patrón expand/contract; no hay down migrations automáticas. Probar rollback en staging antes de producción. Confirmar readiness y smoke, documentar incidente.

## Rotación

JWT_SECRET invalida access tokens; revocar refresh tokens si hay compromiso de sesión. Cambiar password DB/Redis primero en el servicio y luego en el entorno, reiniciando clientes. Rotar SMTP y claves SSH/registry con solapamiento y revocación. **No sustituir las claves de cifrado IA/integraciones sin descifrar y recifrar registros**: no existe una herramienta de recifrado y se perdería acceso a credenciales. Preparar y ensayar esa migración como tarea independiente, con backup de claves bajo control de acceso.

## Opciones gestionadas

Railway/Render/Fly.io: API y cada worker como servicio independiente, Postgres/Redis gestionados, frontend estático con proxy `/api`, migración como release job. La carpeta de documentos local no es compartida entre máquinas: adaptar `storage.js` a almacenamiento de objetos antes de escalar o separar host. Revisar soporte de workers de larga duración, volúmenes y red privada en el proveedor. No se ha creado infraestructura remota.

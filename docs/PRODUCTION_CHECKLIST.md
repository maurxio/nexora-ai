# Checklist de producción

## Implementado en el repositorio

- [x] Tests aislados, mocks IA/OCR, HTTP multi-tenant y RBAC, teardown BullMQ.
- [x] Umbrales de cobertura, lint/formato, Husky/commitlint, Dependabot.
- [x] CI Node 22/24, auditoría y configuración Gitleaks/Trivy.
- [x] Imágenes API/3 workers/frontend, Compose, TLS Caddy, healthchecks y shutdown.
- [x] Migración controlada, scripts backup/restore y procedimiento rollback.

## Obligatorio antes de publicar

- [ ] Configurar environments/reviewers, branch protection y secretos SSH en GitHub.
- [ ] Provisionar VPS staging/producción, DNS, credenciales, SMTP y acceso GHCR.
- [ ] Ejecutar workflows en GitHub y revisar Gitleaks en historial e imágenes Trivy.
- [ ] Smoke, carga, interrupción DB/Redis y rollback en staging con imágenes publicadas.
- [ ] Programar backups, copia externa cifrada, respaldar uploads/claves y ensayar recuperación.
- [ ] Definir RPO/RTO, alertas, responsable de guardia y retención de datos.
- [ ] Resolver/deshabilitar stubs: resumeWorkflow, approval node y agent /run 501.
- [ ] Acotar OCR con timeout real y recursos; revisar idempotencia y duración de shutdown.
- [ ] Decidir si auditoría best-effort satisface requisitos; si no, implementar persistencia transaccional.
- [ ] Ensayar rotación/recifrado de claves IA/integraciones antes de prometer rotación sin pérdida.

La configuración preparada no equivale a un despliegue real ni a certificación de producción. Los resultados locales se registran en DELIVERY.md.

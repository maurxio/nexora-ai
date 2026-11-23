import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { analyticsApi, executionsApi } from '../api/client.js';
import {
  Card,
  Empty,
  ErrorMessage,
  Loading,
  PageHeader,
  StatCard,
  StatusPill,
  Table,
} from '../components/Ui.jsx';

export default function DashboardPage() {
  const { orgId } = useParams();
  const [data, setData] = useState(null);
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);
  const load = () =>
    Promise.all([analyticsApi.overview(orgId, {}), executionsApi.list(orgId, { limit: 5 })])
      .then(([overview, recent]) => {
        setError(null);
        setData(overview);
        setRuns(recent.items || []);
      })
      .catch(setError);
  useEffect(() => {
    load();
  }, [orgId]);
  if (!data && !error) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={load} />;
  return (
    <>
      <PageHeader
        eyebrow="Centro de operaciones"
        title="Resumen"
        description="Actividad y salud de tu organización en los últimos 30 días."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ejecuciones"
          value={data.totalExecutions.toLocaleString('es-CO')}
          detail="en el período"
        />
        <StatCard
          label="Tasa de éxito"
          value={`${(data.successRate * 100).toFixed(1)}%`}
          detail="de ejecuciones completadas"
        />
        <StatCard
          label="Aprobaciones pendientes"
          value={data.pendingApprovals}
          detail="requieren atención"
        />
        <StatCard
          label="Documentos procesados"
          value={data.documentsProcessed}
          detail="en el período"
        />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="font-semibold">Actividad reciente</h2>
          <p className="mt-1 text-xs muted">
            Distribución de las últimas cinco ejecuciones disponibles.
          </p>
          {runs?.length ? (
            <div className="mt-6 space-y-4">
              {['SUCCEEDED', 'RUNNING', 'FAILED'].map((status) => {
                const count = runs.filter((run) => run.status === status).length;
                return (
                  <div key={status}>
                    <div className="mb-2 flex items-center justify-between">
                      <StatusPill status={status} />
                      <span className="text-xs muted tabular-nums">
                        {count} de {runs.length}
                      </span>
                    </div>
                    <div
                      role="meter"
                      aria-label={
                        status === 'SUCCEEDED'
                          ? 'Completadas'
                          : status === 'RUNNING'
                            ? 'En ejecución'
                            : 'Fallidas'
                      }
                      aria-valuemin={0}
                      aria-valuemax={runs.length}
                      aria-valuenow={count}
                      className="h-2 overflow-hidden rounded bg-[var(--surface-muted)]"
                    >
                      <div
                        className="h-full rounded bg-brand-600"
                        style={{ width: `${(count / runs.length) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty>No hay actividad disponible.</Empty>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold">Centro de atención</h2>
          <div className="mt-5 border-l-2 border-[var(--border)] pl-4">
            <p className="text-sm font-medium">Aprobaciones pendientes</p>
            <p className="mt-1 text-sm muted">
              {data.pendingApprovals} solicitudes requieren revisión.
            </p>
          </div>
          <p className="mt-5 text-xs muted">
            Consulta la bandeja de aprobaciones para revisar cada solicitud.
          </p>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Ejecuciones recientes</h2>
            <span className="text-xs muted">Actualizado ahora</span>
          </div>
          {runs?.length ? (
            <Table headers={['Estado', 'Identificador', 'Creada']}>
              <>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-3">
                      <StatusPill status={run.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{run.id.slice(0, 12)}…</td>
                    <td className="px-4 py-3 muted">
                      {new Date(run.createdAt).toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))}
              </>
            </Table>
          ) : (
            <Empty>No hay ejecuciones en este período.</Empty>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold">Rendimiento</h2>
          <div className="mt-6 space-y-5">
            <div>
              <div className="flex justify-between text-sm">
                <span>Duración media</span>
                <strong>{Math.round(data.averageDurationMs)} ms</strong>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>P95 de duración</span>
                <strong>{Math.round(data.p95DurationMs)} ms</strong>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

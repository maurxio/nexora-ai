import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  approvalsApi,
  documentsApi,
  executionsApi,
  integrationsApi,
  analyticsApi,
  notificationsApi,
} from '../api/client.js';
import {
  Button,
  Card,
  Empty,
  ErrorMessage,
  JsonViewer,
  Loading,
  PageHeader,
  Select,
  StatusPill,
  Table,
  Textarea,
  Timeline,
  Modal,
  Drawer,
  ConfirmDialog,
  statusLabel,
  Tabs,
} from '../components/Ui.jsx';

export function RunsPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const load = () =>
    executionsApi
      .list(orgId, { limit: 25, ...(status ? { status } : {}) })
      .then((result) => {
        setError(null);
        setData(result);
      })
      .catch(setError);
  useEffect(() => {
    load();
  }, [orgId, status]);
  if (!data && !error) return <Loading />;
  return (
    <>
      <PageHeader
        eyebrow="Operaciones"
        title="Ejecuciones"
        description="Supervisa el estado y la actividad de tus workflows."
      />
      <div className="mb-4 flex max-w-xs">
        <Select
          label="Filtrar por estado"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {['QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'SUCCEEDED', 'FAILED', 'CANCELLED'].map(
            (value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ),
          )}
        </Select>
      </div>
      {error ? (
        <ErrorMessage error={error} onRetry={load} />
      ) : data.items.length === 0 ? (
        <Empty>No hay ejecuciones para este filtro.</Empty>
      ) : (
        <Table sortable headers={['Estado', 'Ejecución', 'Workflow', 'Creada', 'Acciones']}>
          <>
            {data.items.map((run) => (
              <tr key={run.id}>
                <td className="px-4 py-3">
                  <StatusPill status={run.status} />
                </td>
                <td className="px-4 py-3 font-mono text-xs">{run.id}</td>
                <td className="px-4 py-3 text-xs">{run.workflowId}</td>
                <td className="px-4 py-3 muted">
                  {new Date(run.createdAt).toLocaleString('es-CO')}
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/o/${orgId}/runs/${run.id}`)}
                  >
                    Ver detalle
                  </Button>
                </td>
              </tr>
            ))}
          </>
        </Table>
      )}
    </>
  );
}

export function RunDetailPage() {
  const { orgId, id } = useParams();
  const [run, setRun] = useState(null);
  const [steps, setSteps] = useState([]);
  const [error, setError] = useState(null);
  const load = () =>
    Promise.all([executionsApi.get(orgId, id), executionsApi.steps(orgId, id)])
      .then(([item, list]) => {
        setError(null);
        setRun(item);
        setSteps(list);
      })
      .catch(setError);
  useEffect(() => {
    load();
  }, [orgId, id]);
  if (!run && !error) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={load} />;
  return (
    <>
      <PageHeader
        title="Detalle de ejecución"
        description={run.id}
        actions={<StatusPill status={run.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-5 font-semibold">Secuencia de pasos</h2>
          {steps.length ? (
            <Timeline items={steps} />
          ) : (
            <Empty>No hay pasos registrados todavía.</Empty>
          )}
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Entrada</h2>
          <JsonViewer value={run.input} />
          <h2 className="mb-4 mt-6 font-semibold">Error</h2>
          <p className="text-sm text-red-700 dark:text-red-300">
            {run.error || 'Sin errores registrados.'}
          </p>
        </Card>
      </div>
    </>
  );
}

export function ApprovalsPage() {
  const { orgId } = useParams();
  const [status, setStatus] = useState('PENDING');
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [deciding, setDeciding] = useState(false);
  const requestDecision = (action) => {
    if (action === 'reject' && !comment.trim())
      return setError(new Error('El comentario es obligatorio al rechazar.'));
    setConfirmation(action);
  };
  const [error, setError] = useState(null);
  const load = () =>
    approvalsApi
      .list(orgId, { status, limit: 25 })
      .then((result) => {
        setError(null);
        setData(result);
      })
      .catch(setError);
  useEffect(() => {
    load();
  }, [orgId, status]);
  const decide = async (action) => {
    if (action === 'reject' && !comment.trim())
      return setError(new Error('El comentario es obligatorio al rechazar.'));
    setDeciding(true);
    try {
      await approvalsApi[action](orgId, selected.id, comment);
      setConfirmation(null);
      setSelected(null);
      setComment('');
      load();
    } catch (err) {
      setError(err);
      setConfirmation(null);
    } finally {
      setDeciding(false);
    }
  };
  if (!data && !error) return <Loading />;
  return (
    <>
      <PageHeader
        eyebrow="Control"
        title="Aprobaciones"
        description="Revisa y decide solicitudes que detienen procesos."
      />
      <Tabs
        label="Bandejas de aprobaciones"
        value={status === 'PENDING' ? 'PENDING' : 'APPROVED'}
        onChange={setStatus}
        items={[
          { value: 'PENDING', label: 'Pendientes' },
          { value: 'APPROVED', label: 'Resueltas' },
        ]}
      />
      {error && !selected && <ErrorMessage error={error} onRetry={load} />}
      {data?.items.length === 0 ? (
        <Empty>No hay aprobaciones en esta bandeja.</Empty>
      ) : (
        <Table sortable headers={['Estado', 'Solicitud', 'Creada', 'Acción']}>
          <>
            {data?.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <StatusPill status={item.status} />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs muted">{item.description || 'Sin descripción'}</p>
                </td>
                <td className="px-4 py-3 text-sm muted">
                  {new Date(item.createdAt).toLocaleString('es-CO')}
                </td>
                <td className="px-4 py-3">
                  <Button variant="secondary" onClick={() => setSelected(item)}>
                    Revisar
                  </Button>
                </td>
              </tr>
            ))}
          </>
        </Table>
      )}

      {selected && (
        <Modal title="Revisar solicitud" onClose={() => setSelected(null)}>
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <p className="mt-1 text-sm muted">{selected.description}</p>
              </div>
              <StatusPill status={selected.status} />
            </div>
            <div className="my-5">
              <JsonViewer value={selected.payload} />
            </div>
            <ErrorMessage error={error} />
            <Textarea
              label="Comentario (obligatorio para rechazar)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Cerrar
              </Button>
              <Button variant="danger" onClick={() => requestDecision('reject')}>
                Rechazar
              </Button>
              <Button onClick={() => requestDecision('approve')}>Aprobar</Button>
            </div>
          </div>
        </Modal>
      )}
      {confirmation && (
        <ConfirmDialog
          title={confirmation === 'approve' ? 'Aprobar solicitud' : 'Rechazar solicitud'}
          description="La decisión se aplicará a esta solicitud y al proceso asociado."
          danger={confirmation === 'reject'}
          loading={deciding}
          onClose={() => !deciding && setConfirmation(null)}
          onConfirm={() => decide(confirmation)}
        />
      )}
    </>
  );
}

export function NotificationsPage() {
  const { orgId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = () =>
    notificationsApi
      .list(orgId, { limit: 50 })
      .then((result) => {
        setError(null);
        setData(result);
      })
      .catch(setError);
  useEffect(() => {
    load();
  }, [orgId]);
  const mark = async (id) => {
    await notificationsApi.markRead(orgId, id);
    load();
  };
  if (!data && !error) return <Loading />;
  return (
    <>
      <PageHeader
        title="Notificaciones"
        actions={
          <Button
            variant="secondary"
            onClick={async () => {
              await notificationsApi.markAllRead(orgId);
              load();
            }}
          >
            Marcar todas como leídas
          </Button>
        }
      />
      {error ? (
        <ErrorMessage error={error} onRetry={load} />
      ) : data.items.length === 0 ? (
        <Empty>No tienes notificaciones.</Empty>
      ) : (
        <div className="space-y-2">
          {data.items.map((item) => (
            <button
              key={item.id}
              onClick={() => mark(item.id)}
              className={`surface block w-full rounded-lg p-4 text-left ${item.readAt ? 'opacity-60' : 'border-blue-200 dark:border-blue-800'}`}
            >
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm muted">{item.body}</p>
              <p className="mt-2 text-xs muted">
                {new Date(item.createdAt).toLocaleString('es-CO')}
              </p>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function DocumentsPage() {
  const { orgId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const load = () =>
    documentsApi
      .list(orgId, { limit: 25 })
      .then((result) => {
        setError(null);
        setData(result);
      })
      .catch(setError);
  useEffect(() => {
    load();
  }, [orgId]);
  if (!data && !error) return <Loading />;
  return (
    <>
      <PageHeader
        eyebrow="Automatización"
        title="Documentos"
        description="Procesamiento y validación de archivos empresariales."
      />
      {error ? (
        <ErrorMessage error={error} onRetry={load} />
      ) : data.data.length === 0 ? (
        <Empty>No hay documentos cargados.</Empty>
      ) : (
        <Table sortable headers={['Archivo', 'Tipo', 'Estado', 'Fecha']}>
          <>
            {data.data.map((doc) => (
              <tr key={doc.id}>
                <td className="px-4 py-3 font-medium">
                  <button
                    className="text-left text-brand-700 underline dark:text-brand-300"
                    onClick={() => setSelected(doc)}
                  >
                    {doc.originalName}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm muted">{doc.docType || 'Pendiente'}</td>
                <td className="px-4 py-3">
                  <StatusPill status={doc.status} />
                </td>
                <td className="px-4 py-3 text-sm muted">
                  {new Date(doc.createdAt).toLocaleString('es-CO')}
                </td>
              </tr>
            ))}
          </>
        </Table>
      )}
      {selected && (
        <Drawer title="Detalle del documento" onClose={() => setSelected(null)}>
          <h3 className="mb-3 break-words font-medium">{selected.originalName}</h3>
          <StatusPill status={selected.status} />
          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="muted">Tipo de documento</dt>
              <dd>{selected.docType || 'Pendiente de clasificación'}</dd>
            </div>
            <div>
              <dt className="muted">Fecha de carga</dt>
              <dd>{new Date(selected.createdAt).toLocaleString('es-CO')}</dd>
            </div>
            <div>
              <dt className="muted">Identificador</dt>
              <dd className="break-all font-mono text-xs">{selected.id}</dd>
            </div>
          </dl>
        </Drawer>
      )}
    </>
  );
}

export function IntegrationsPage() {
  const { orgId } = useParams();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const load = () =>
    integrationsApi
      .list(orgId)
      .then((result) => {
        setError(null);
        setItems(result);
      })
      .catch(setError);
  useEffect(() => {
    load();
  }, [orgId]);
  if (!items && !error) return <Loading />;
  return (
    <>
      <PageHeader
        title="Integraciones"
        description="Conectores HTTP y servicios externos de tu organización."
      />
      {error ? (
        <ErrorMessage error={error} onRetry={load} />
      ) : items.length === 0 ? (
        <Empty>No hay conectores configurados.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="flex justify-between">
                <div>
                  <h2 className="font-semibold">{item.name}</h2>
                  <p className="mt-1 text-sm muted">
                    {item.type} · {item.baseUrl || 'Sin URL base'}
                  </p>
                </div>
                <StatusPill status={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                <span className="text-xs muted">
                  {item.lastEventAt
                    ? `Último evento: ${new Date(item.lastEventAt).toLocaleString('es-CO')}`
                    : 'Sin información del último evento'}
                </span>
                <Button variant="secondary" size="sm" onClick={() => setSelected(item)}>
                  Ver configuración
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {selected && (
        <Drawer title="Configuración del conector" onClose={() => setSelected(null)}>
          <h3 className="mb-3 font-medium">{selected.name}</h3>
          <StatusPill status={selected.isActive ? 'ACTIVE' : 'INACTIVE'} />
          <dl className="mt-6 space-y-5 text-sm">
            <div>
              <dt className="muted">Tipo</dt>
              <dd>{selected.type}</dd>
            </div>
            <div>
              <dt className="muted">Dirección base</dt>
              <dd className="break-all">{selected.baseUrl || 'Sin URL base'}</dd>
            </div>
          </dl>
          <p className="mt-6 text-xs muted">
            La edición de la configuración no está disponible en esta vista.
          </p>
        </Drawer>
      )}
    </>
  );
}

export function AnalyticsPage() {
  const { orgId } = useParams();
  const [overview, setOverview] = useState(null);
  const [errors, setErrors] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    Promise.all([analyticsApi.overview(orgId, {}), analyticsApi.errors(orgId, {})])
      .then(([o, e]) => {
        setOverview(o);
        setErrors(e);
      })
      .catch(setError);
  }, [orgId]);
  if (!overview && !error) return <Loading />;
  return (
    <>
      <PageHeader
        title="Observabilidad y analítica"
        description="Rendimiento, fiabilidad y errores de automatización."
      />
      {error ? (
        <ErrorMessage error={error} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Ejecuciones" value={overview.totalExecutions} />
            <Stat label="Éxito" value={`${(overview.successRate * 100).toFixed(1)}%`} />
            <Stat label="P95" value={`${Math.round(overview.p95DurationMs)} ms`} />
          </div>
          <Card className="mt-6">
            <h2 className="mb-4 font-semibold">Errores principales</h2>
            {errors.length ? (
              <Table sortable headers={['Código', 'Ocurrencias', 'Último evento']}>
                <>
                  {errors.map((item) => (
                    <tr key={item.errorCode}>
                      <td className="px-4 py-3 font-mono text-xs">{item.errorCode}</td>
                      <td className="px-4 py-3">{item.count}</td>
                      <td className="px-4 py-3 muted">
                        {item.lastOccurred && new Date(item.lastOccurred).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </>
              </Table>
            ) : (
              <Empty>No se registraron errores.</Empty>
            )}
          </Card>
        </>
      )}
    </>
  );
}
function Stat({ label, value }) {
  return (
    <Card>
      <p className="text-sm muted">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </Card>
  );
}

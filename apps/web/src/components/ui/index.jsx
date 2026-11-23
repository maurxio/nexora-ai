import { useId, useRef, useEffect, useState, Children, Fragment } from 'react';
import { Inbox, X, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';

const cn = (...items) => items.filter(Boolean).join(' ');
export function Button({
  children,
  variant = 'primary',
  loading = false,
  size = 'md',
  disabled = false,
  className = '',
  ...props
}) {
  const styles = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800',
    secondary:
      'bg-[var(--surface)] text-slate-700 dark:text-slate-200 border border-[var(--border)] hover:bg-[var(--surface-muted)]',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 dark:text-slate-300 hover:bg-[var(--surface-muted)]',
  };
  return (
    <button
      className={cn(
        'inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'min-h-8 px-2.5 py-1 text-xs',
        styles[variant],
        className,
      )}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
}
function Field({
  as: Control = 'input',
  label,
  hint,
  error,
  className = '',
  id: suppliedId,
  children,
  ...props
}) {
  const generatedId = useId();
  const id = suppliedId || generatedId;
  const descriptionId = `${id}-description`;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
          {label}
        </label>
      )}
      <Control
        {...props}
        id={id}
        className={`control ${Control === 'textarea' ? 'min-h-24' : ''}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? descriptionId : undefined}
      >
        {children}
      </Control>
      {(error || hint) && (
        <p id={descriptionId} className={`mt-1.5 text-xs ${error ? 'text-danger' : 'muted'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
export function Input(props) {
  return <Field {...props} />;
}
export function Select(props) {
  return <Field {...props} as="select" />;
}
export function Textarea(props) {
  return <Field {...props} as="textarea" />;
}
export function Card({ children, className = '' }) {
  return <div className={cn('surface rounded-lg p-5 shadow-sm', className)}>{children}</div>;
}
export function Badge({ children, tone = 'neutral' }) {
  const colors = {
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
    success: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300',
    warning: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300',
    danger: 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300',
    info: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300',
  };
  return (
    <span
      className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', colors[tone])}
    >
      {children}
    </span>
  );
}
export const statusLabel = (status) =>
  ({
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    SUCCEEDED: 'Completado',
    APPROVED: 'Aprobado',
    VALIDATED: 'Validado',
    PROCESSED: 'Procesado',
    FAILED: 'Fallido',
    REJECTED: 'Rechazado',
    CANCELLED: 'Cancelado',
    NEEDS_REVIEW: 'Requiere revisión',
    RUNNING: 'En ejecución',
    PROCESSING: 'En procesamiento',
    PENDING: 'Pendiente',
    WAITING_APPROVAL: 'En aprobación',
    QUEUED: 'En cola',
    UPLOADED: 'Cargado',
    OCR: 'Reconocimiento de texto',
    EXTRACTED: 'Extraído',
    DRAFT: 'Borrador',
    PUBLISHED: 'Publicado',
  })[status] || 'Sin clasificar';
export const StatusPill = ({ status }) => {
  const tone = ['ACTIVE', 'SUCCEEDED', 'APPROVED', 'VALIDATED', 'PROCESSED'].includes(status)
    ? 'success'
    : ['FAILED', 'REJECTED', 'CANCELLED', 'NEEDS_REVIEW'].includes(status)
      ? 'danger'
      : ['RUNNING', 'PROCESSING', 'PENDING', 'WAITING_APPROVAL'].includes(status)
        ? 'warning'
        : 'neutral';
  return <Badge tone={tone}>{statusLabel(status)}</Badge>;
};
export function PageHeader({ eyebrow, title, description, actions, breadcrumbs }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {breadcrumbs && (
          <nav aria-label="Ruta de navegación" className="mb-2 text-xs muted">
            {breadcrumbs}
          </nav>
        )}
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
export function EmptyState({ title = 'Sin registros', description, action, icon: Icon = Inbox }) {
  return (
    <div className="surface flex min-h-52 flex-col items-center justify-center rounded-lg px-6 py-10 text-center">
      <span className="mb-4 rounded-lg border border-[var(--border)] p-3 muted">
        <Icon size={22} aria-hidden="true" />
      </span>
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-sm muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Empty({ children, action }) {
  return (
    <EmptyState
      title={children}
      description="Los registros aparecerán aquí cuando estén disponibles."
      action={action}
    />
  );
}
export function Loading({ label = 'Cargando información' }) {
  return (
    <div className="space-y-4" aria-label={label} aria-busy="true">
      <div className="h-7 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
      <div className="h-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
export function ErrorMessage({ error, onRetry }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-800 dark:text-red-300"
    >
      <span>
        {error.status === 403
          ? 'No tienes permisos para consultar este recurso.'
          : error.message || 'Ocurrió un error inesperado.'}
      </span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
export function ErrorState({ onRetry }) {
  return (
    <div className="py-16 text-center">
      <h2 className="font-semibold">No pudimos cargar esta vista</h2>
      <p className="mt-1 text-sm muted">Revisa tu conexión e inténtalo nuevamente.</p>
      {onRetry && (
        <Button className="mt-4" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
export function StatCard({ label, value, detail, trend }) {
  return (
    <Card>
      <p className="text-sm muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {detail && (
        <p className="mt-2 text-xs muted">
          {trend && (
            <span
              className={
                trend > 0
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-red-600 dark:text-red-300'
              }
            >
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}{' '}
          {detail}
        </p>
      )}
    </Card>
  );
}
export function Table({
  headers,
  children,
  caption = 'Listado de registros',
  sortable = false,
  pageSize = 10,
}) {
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState(null);
  const flatten = (nodes) =>
    Children.toArray(nodes).flatMap((node) =>
      node.type === Fragment ? flatten(node.props.children) : [node],
    );
  let rows = flatten(children);
  const cellText = (node) =>
    typeof node === 'string' || typeof node === 'number'
      ? String(node)
      : node?.props?.status
        ? statusLabel(node.props.status)
        : Children.toArray(node?.props?.children).map(cellText).join(' ');
  if (order)
    rows = [...rows].sort(
      (a, b) =>
        cellText(Children.toArray(a.props.children)[order.index]).localeCompare(
          cellText(Children.toArray(b.props.children)[order.index]),
          'es',
          { numeric: true },
        ) * order.direction,
    );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  return (
    <div className="surface overflow-hidden rounded-lg">
      <div className="max-h-[560px] overflow-auto" role="region" aria-label={caption} tabIndex={0}>
        <table className="w-full min-w-[640px] text-left text-sm tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-[var(--border)] text-xs muted">
            <tr>
              {headers.map((header, index) => (
                <th
                  scope="col"
                  aria-sort={
                    order?.index === index
                      ? order.direction === 1
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  className="px-4 py-3 font-medium"
                  key={header}
                >
                  {sortable && !['Acciones', 'Acción'].includes(header) ? (
                    <button
                      className="flex min-h-6 items-center gap-2"
                      onClick={() => {
                        setOrder({
                          index,
                          direction: order?.index === index ? -order.direction : 1,
                        });
                        setPage(1);
                      }}
                    >
                      {header}
                      {order?.index === index && order.direction === -1 ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronUp size={14} />
                      )}
                    </button>
                  ) : (
                    header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <div className="border-t border-[var(--border)] p-3">
          <Pagination page={currentPage} total={rows.length} limit={pageSize} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="surface space-y-3 rounded-lg p-4">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: cols }, (_, col) => (
            <div
              key={col}
              className="h-5 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-700"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
export function JsonViewer({ value }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-200">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}
export function Timeline({ items = [] }) {
  return (
    <ol className="space-y-4">
      {items.map((item, index) => (
        <li className="relative flex gap-3" key={item.id || item.nodeId || index}>
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900" />
          <div>
            <p className="text-sm font-medium">{item.label || item.nodeType || item.nodeId}</p>
            <p className="text-xs muted">
              {item.createdAt || item.startedAt
                ? new Date(item.createdAt || item.startedAt).toLocaleString('es-CO')
                : 'Sin fecha'}{' '}
              · {statusLabel(item.status)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
export function Pagination({ page, total, limit, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between text-sm muted">
      <span>{total} resultados</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </Button>
        <span>
          {page} / {pages}
        </span>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
export const LoadingState = Loading;

export function Skeleton({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-700 ${className}`}
    />
  );
}
export function Modal({ open = true, onClose, title, children, drawer = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`ui-dialog ${drawer ? 'ui-drawer' : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose?.();
      }}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <Button variant="ghost" aria-label="Cerrar diálogo" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function Drawer(props) {
  return <Modal {...props} drawer />;
}
export function ConfirmDialog({
  title = 'Confirmar acción',
  description,
  onConfirm,
  onClose,
  loading,
  danger = false,
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm muted">{description}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
          Confirmar
        </Button>
      </div>
    </Modal>
  );
}
export function Tabs({ items, value, onChange, label = 'Vistas' }) {
  const refs = useRef([]);
  return (
    <div
      role="tablist"
      aria-label={label}
      className="mb-5 flex gap-1 border-b border-[var(--border)]"
    >
      {items.map((item, index) => (
        <button
          key={item.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          role="tab"
          aria-selected={value === item.value}
          tabIndex={value === item.value ? 0 : -1}
          className={`border-b-2 px-4 py-3 text-sm font-medium ${value === item.value ? 'border-brand-700 text-brand-700 dark:text-brand-300' : 'border-transparent muted'}`}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => {
            const next =
              event.key === 'ArrowRight'
                ? (index + 1) % items.length
                : event.key === 'ArrowLeft'
                  ? (index + items.length - 1) % items.length
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : null;
            if (next !== null) {
              event.preventDefault();
              refs.current[next]?.focus();
              onChange(items[next].value);
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
export function Toast({ children, onClose, tone = 'success' }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className="surface fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-lg p-4 shadow-md"
    >
      <AlertCircle size={18} className={`text-${tone}`} />
      <span>{children}</span>
      <Button variant="ghost" onClick={onClose} aria-label="Cerrar aviso">
        <X size={16} />
      </Button>
    </div>
  );
}
export function Tooltip({ label, children }) {
  const id = useId();
  return (
    <span className="tooltip-host relative inline-flex" aria-describedby={id}>
      {children}
      <span id={id} role="tooltip" className="tooltip-label">
        {label}
      </span>
    </span>
  );
}

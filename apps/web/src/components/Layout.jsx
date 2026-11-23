import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { organizationsApi, notificationsApi } from '../api/client.js';
import { useSession } from '../auth/SessionContext.jsx';
import { Button, ErrorMessage, Loading, Drawer, Input } from './Ui.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';

import {
  LayoutDashboard,
  GitBranch,
  Play,
  CheckCheck,
  Files,
  Bot,
  Plug,
  Activity,
  Settings,
  Bell,
  Search,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Sun,
  Moon,
  ChevronDown,
} from 'lucide-react';

const navigation = [
  [
    'Operación',
    [
      ['dashboard', 'Resumen', LayoutDashboard],
      ['runs', 'Ejecuciones', Play],
      ['approvals', 'Aprobaciones', CheckCheck],
    ],
  ],
  [
    'Automatización',
    [
      ['workflows', 'Workflows', GitBranch],
      ['agents', 'Agentes', Bot],
      ['integrations', 'Integraciones', Plug],
    ],
  ],
  [
    'Datos',
    [
      ['documents', 'Documentos', Files],
      ['analytics', 'Observabilidad', Activity],
    ],
  ],
  ['Administración', [['settings', 'Configuración', Settings]]],
];
export default function Layout() {
  const { orgId } = useParams();
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const shortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([
      organizationsApi.list(),
      organizationsApi.get(orgId),
      notificationsApi.unreadCount(orgId),
    ])
      .then(([list, current, count]) => {
        if (active) {
          setOrganizations(list);
          setOrganization(current);
          setUnread(count.count);
        }
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [orgId]);
  if (loading)
    return (
      <main className="mx-auto max-w-7xl p-8">
        <Loading />
      </main>
    );
  if (error)
    return (
      <main className="mx-auto max-w-3xl p-8">
        <ErrorMessage error={error} />
        <Link className="mt-4 inline-block text-blue-700 dark:text-blue-300 underline" to="/orgs">
          Volver a organizaciones
        </Link>
      </main>
    );
  const membership = organizations.find((item) => item.id === orgId);
  const role = membership?.role;
  const leave = async () => {
    await signOut();
    navigate('/login');
  };
  const organizationSelect = (
    <select
      aria-label="Organización activa"
      value={orgId}
      onChange={(event) => {
        navigate(`/o/${event.target.value}/dashboard`);
        setMobile(false);
      }}
      className="control min-w-0 text-sm"
    >
      {organizations.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
  const navigationContent = (compact = false) => (
    <>
      <div className="mb-5 flex items-center gap-2 px-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-700 text-base font-semibold text-white">
          N
        </span>
        {!compact && (
          <Link to={`/o/${orgId}/dashboard`} className="text-base font-semibold tracking-tight">
            NEXORA <span className="muted">AI</span>
          </Link>
        )}
      </div>
      {!compact && <div className="mb-5">{organizationSelect}</div>}
      <nav aria-label="Navegación principal" className="space-y-6">
        {navigation.map(([group, links]) => (
          <div key={group}>
            {!compact && <p className="mb-2 px-2 text-xs font-medium muted">{group}</p>}
            <div className="space-y-1">
              {links.map(([path, label, Icon]) => (
                <NavLink
                  key={path}
                  to={`/o/${orgId}/${path}`}
                  title={compact ? label : undefined}
                  aria-label={compact ? label : undefined}
                  onClick={() => setMobile(false)}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} aria-hidden="true" className="shrink-0" />
                  {!compact && label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-auto border-t border-[var(--border)] pt-4">
        <div className="mb-3 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-semibold">
            {user?.name?.slice(0, 2).toUpperCase() || 'US'}
          </span>
          {!compact && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="text-xs muted">
                {{ ADMIN: 'Administrador', OPERATOR: 'Operador', AUDITOR: 'Auditor' }[role] ||
                  'Miembro'}
              </p>
            </div>
          )}
        </div>
        <Button variant="ghost" onClick={leave} className="w-full" aria-label="Cerrar sesión">
          <LogOut size={16} />
          {!compact && 'Cerrar sesión'}
        </Button>
      </div>
    </>
  );
  return (
    <div className="min-h-screen">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <aside
        className={`fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-[var(--border)] bg-[var(--surface)] p-4 lg:flex ${collapsed ? 'w-20' : 'w-60'}`}
      >
        {navigationContent(collapsed)}
      </aside>
      {mobile && (
        <Drawer title="Navegación" onClose={() => setMobile(false)}>
          <div className="flex min-h-[75dvh] flex-col">{navigationContent()}</div>
        </Drawer>
      )}
      <div className={collapsed ? 'lg:pl-20' : 'lg:pl-60'}>
        <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex min-h-16 items-center gap-2 px-4 sm:px-8">
            <Button
              variant="ghost"
              className="lg:hidden"
              aria-label="Abrir navegación"
              onClick={() => setMobile(true)}
            >
              <Menu size={18} />
            </Button>
            <Button
              variant="ghost"
              className="hidden lg:inline-flex"
              aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </Button>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex min-h-9 min-w-0 items-center gap-2 rounded-md px-2 text-sm muted hover:bg-[var(--surface-muted)]"
              aria-label="Buscar en la navegación"
            >
              <Search size={17} />
              <span className="hidden sm:inline">Buscar en NEXORA…</span>
              <kbd className="ml-8 hidden rounded border px-1.5 text-xs md:inline">Ctrl K / ⌘K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                onClick={toggleTheme}
                aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
                aria-pressed={dark}
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </Button>
              <Link
                className="relative rounded-md p-2 muted hover:bg-[var(--surface-muted)]"
                to={`/o/${orgId}/notifications`}
                aria-label={`Notificaciones${unread ? `: ${unread} sin leer` : ''}`}
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-700 px-1.5 text-[10px] text-white">
                    {unread}
                  </span>
                )}
              </Link>
              <details className="relative ml-2">
                <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-sm">
                  <span className="max-w-28 truncate">{user?.name || 'Mi cuenta'}</span>
                  <ChevronDown size={14} />
                </summary>
                <div className="surface absolute right-0 mt-2 w-52 rounded-lg p-2 shadow-md">
                  <Link to="/orgs" className="nav-item">
                    Mis organizaciones
                  </Link>
                  <Button variant="ghost" onClick={leave} className="w-full justify-start">
                    Cerrar sesión
                  </Button>
                </div>
              </details>
            </div>
          </div>
        </header>
        <main id="contenido" tabIndex={-1} className="mx-auto max-w-[1440px] p-4 sm:p-8 xl:px-10">
          <div className="mb-6 flex items-center gap-2 text-xs muted">
            <span>{organization?.name}</span>
            <span aria-hidden="true">/</span>
            <span>Espacio de trabajo</span>
          </div>
          <Outlet context={{ role, organization }} />
        </main>
      </div>
      {searchOpen && (
        <Drawer
          title="Buscar en la navegación"
          onClose={() => {
            setSearchOpen(false);
            setQuery('');
          }}
        >
          <Input
            label="Pantalla"
            placeholder="Escribe el nombre de una sección"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <nav aria-label="Resultados de búsqueda" className="mt-4 space-y-1">
            {navigation
              .flatMap(([, links]) => links)
              .filter(([, label]) =>
                label.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')),
              )
              .map(([path, label, Icon]) => (
                <Link
                  key={path}
                  to={`/o/${orgId}/${path}`}
                  className="nav-item"
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery('');
                  }}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
          </nav>
          <p className="mt-4 text-xs muted">Busca secciones de tu espacio de trabajo.</p>
        </Drawer>
      )}
    </div>
  );
}

import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionContext.jsx';
export default function ProtectedRoute() {
  const { user, loading } = useSession();
  if (loading) return <p className="p-8 text-center text-slate-500">Cargando sesión...</p>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

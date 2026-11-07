import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client.js';
import { useSession } from '../auth/SessionContext.jsx';
import { Button, ErrorMessage, Input } from '../components/Ui.jsx';

function AuthForm({ register = false }) {
  const { user, signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  if (user) return <Navigate to="/orgs" replace />;
  const submit = async (event) => {
    event.preventDefault(); setError(null);
    if (form.password.length < 8 || (register && !form.name.trim())) return setError(new Error(register ? 'Completa el nombre y usa una contraseña de al menos 8 caracteres.' : 'La contraseña debe tener al menos 8 caracteres.'));
    setSending(true);
    try { signIn(await (register ? authApi.register(form) : authApi.login({ email: form.email, password: form.password }))); navigate(location.state?.from || '/orgs'); } catch (err) { setError(err); } finally { setSending(false); }
  };
  return <main className="flex min-h-screen items-center justify-center p-4"><form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold">{register ? 'Crear cuenta' : 'Iniciar sesión'}</h1>{register && <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /> }<Input label="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /><Input label="Contraseña" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /><ErrorMessage error={error} /><Button disabled={sending} className="w-full">{sending ? 'Enviando...' : register ? 'Registrarme' : 'Entrar'}</Button><p className="text-sm text-slate-600">{register ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}<Link className="text-blue-700 underline" to={register ? '/login' : '/register'}>{register ? 'Inicia sesión' : 'Regístrate'}</Link></p></form></main>;
}
export function Login() { return <AuthForm />; }
export function Register() { return <AuthForm register />; }

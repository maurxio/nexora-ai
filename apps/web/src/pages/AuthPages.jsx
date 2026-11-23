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
  const [submitted, setSubmitted] = useState(false);
  if (user) return <Navigate to="/orgs" replace />;
  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    if (form.password.length < 8 || (register && !form.name.trim()))
      return setError(
        new Error(
          register
            ? 'Completa el nombre y usa una contraseña de al menos 8 caracteres.'
            : 'La contraseña debe tener al menos 8 caracteres.',
        ),
      );
    setSending(true);
    try {
      signIn(
        await (register
          ? authApi.register(form)
          : authApi.login({ email: form.email, password: form.password })),
      );
      navigate(location.state?.from || '/orgs');
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  };
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="surface w-full max-w-md space-y-5 rounded-lg p-6 shadow-md sm:p-8"
      >
        <div className="mb-6 flex items-center gap-2 text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-white">
            N
          </span>
          NEXORA <span className="muted">AI</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {register ? 'Crear cuenta' : 'Iniciar sesión'}
        </h1>
        <p className="text-sm muted">Accede al espacio de automatización de tu organización.</p>
        {register && (
          <Input
            label="Nombre"
            autoComplete="name"
            error={submitted && !form.name.trim() ? 'Introduce tu nombre.' : undefined}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        )}
        <Input
          label="Correo"
          type="email"
          autoComplete="email"
          placeholder="nombre@empresa.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <Input
          label="Contraseña"
          type="password"
          autoComplete={register ? 'new-password' : 'current-password'}
          hint="Utiliza al menos 8 caracteres."
          error={
            submitted && form.password.length < 8
              ? 'La contraseña debe tener al menos 8 caracteres.'
              : undefined
          }
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <ErrorMessage
          error={
            error?.message === 'La contraseña debe tener al menos 8 caracteres.' ? null : error
          }
        />
        <Button loading={sending} className="w-full">
          {sending ? 'Enviando...' : register ? 'Registrarme' : 'Entrar'}
        </Button>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {register ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
          <Link
            className="text-blue-700 dark:text-blue-300 underline"
            to={register ? '/login' : '/register'}
          >
            {register ? 'Inicia sesión' : 'Regístrate'}
          </Link>
        </p>
      </form>
    </main>
  );
}
export function Login() {
  return <AuthForm />;
}
export function Register() {
  return <AuthForm register />;
}

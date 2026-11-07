export function Button({ children, className = '', ...props }) {
  return <button className={`rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>{children}</button>;
}

export function Input({ label, ...props }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" {...props} /></label>;
}

export function ErrorMessage({ error }) {
  if (!error) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error.message || 'Ocurrió un error'}</p>;
}

export function Loading() { return <p className="py-8 text-center text-slate-500">Cargando...</p>; }
export function Empty({ children }) { return <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">{children}</p>; }

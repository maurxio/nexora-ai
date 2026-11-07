import { Link } from 'react-router-dom';
export default function NotFound() { return <main className="mx-auto max-w-xl p-8 text-center"><h1 className="text-3xl font-bold">Página no encontrada</h1><Link className="mt-4 inline-block text-blue-700 underline" to="/orgs">Ir a organizaciones</Link></main>; }

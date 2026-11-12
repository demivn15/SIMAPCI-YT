/**
 * Vista pública sin sesión - HU02, criterio CA06 ("la visualización pública sigue
 * disponible sin sesión"). El catálogo público completo llega con HU05 (Sprint 2);
 * mientras tanto esta página es la entrada pública y enlaza al prototipo publicado.
 */
import { Link } from 'react-router-dom';

const PUBLIC_CATALOG_URL = 'https://demivn15.github.io/SIMAPCI-YT/';

export default function PublicHomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-6">
      <main className="mx-auto w-full max-w-2xl text-center">
        <h1 className="text-3xl font-extrabold text-slate-900">Producción científica de la ECMC</h1>
        <p className="mt-3 text-slate-600">
          Consulta las publicaciones y proyectos de investigación de la Escuela de Ciencias Matemáticas y
          Computacionales de Yachay Tech.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={PUBLIC_CATALOG_URL}
            className="py-2 px-4 rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Ver la producción científica
          </a>
          <Link
            to="/login"
            className="py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Acceso para profesores
          </Link>
        </div>
      </main>
    </div>
  );
}

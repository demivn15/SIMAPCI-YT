/**
 * Inicio del profesor: «Accesos rápidos», como en el prototipo. Solo aparecen las acciones
 * que ya funcionan (registrar publicación y proyecto).
 */
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, FolderPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ACCOUNT_CREATED_MESSAGE } from '../utils/loginMessages';

export default function DashboardPage() {
  const { user } = useAuth();
  // T-HU01-06 (PGPCECMC-23), CA01: confirmación del registro en el primer acceso
  const accountCreated = useLocation().state?.accountCreated === true;

  return (
    <>
      {accountCreated && (
        <div className="notice-success" role="status">
          {ACCOUNT_CREATED_MESSAGE}
        </div>
      )}
      <section aria-labelledby="quick-actions-title">
        <p className="greeting">Hola, {user?.name}</p>
        <h1 id="quick-actions-title" className="display page-title">
          Accesos rápidos
        </h1>
        <div className="quick-actions">
          <Link to="/products/new?tipo=publicacion">
            <BookOpen aria-hidden="true" />
            <strong>Registrar publicación</strong>
            <span>Artículos, libros y otros trabajos publicados</span>
          </Link>
          <Link to="/products/new?tipo=proyecto">
            <FolderPlus aria-hidden="true" />
            <strong>Registrar proyecto</strong>
            <span>Agregue su proyecto de investigación</span>
          </Link>
        </div>
      </section>
    </>
  );
}

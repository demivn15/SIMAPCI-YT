/**
 * Pantalla de acceso de la ECMC (vista pública y fondo de /login), con el aspecto del
 * prototipo. Desde aquí el visitante entra sin iniciar sesión a la Escuela (/inicio) o al
 * catálogo público (/produccion, HU05 - T-HU05-01).
 */
import { Link } from 'react-router-dom';
import { BarChart3, BookOpen, LogIn } from 'lucide-react';
import { SCHOOL } from '../../constants/school';
import { EcmcLogo, YachayLogo } from './Brand';

export default function AccessScreen({ dialog = null }) {
  // Con el cuadro de inicio de sesión abierto, el fondo queda fuera del alcance del
  // teclado y de los lectores de pantalla, como en una ventana modal.
  const background = dialog ? { 'aria-hidden': true, inert: true } : {};

  return (
    <>
      <div className="access" {...background}>
        <header className="access-header">
          <div className="access-brand">
            <YachayLogo width={130} />
            <span>
              <strong>SIMAPCI</strong>
              <small>{SCHOOL.shortName}</small>
            </span>
          </div>
          <Link to="/login" className="btn btn-primary access-login">
            <LogIn size={20} aria-hidden="true" />
            Iniciar sesión
          </Link>
        </header>

        <main className="access-main">
          <div>
            <h1 className="display">
              Un espacio para
              <br />
              su investigación.
            </h1>
            <p className="access-description">Publicaciones, proyectos y la comunidad científica de nuestra escuela.</p>
            <div className="shell-access-actions">
              <Link to="/inicio" className="btn btn-primary access-catalog">
                <BarChart3 size={20} aria-hidden="true" />
                Conocer la Escuela
              </Link>
              <Link to="/produccion" className="btn btn-outline access-catalog">
                <BookOpen size={20} aria-hidden="true" />
                Consultar la producción científica
              </Link>
            </div>
            <dl className="access-dean">
              <dt>Decano</dt>
              <dd>{SCHOOL.dean}</dd>
            </dl>
          </div>
          <div className="access-art">
            <EcmcLogo size={340} />
          </div>
        </main>

        <footer className="access-footer">
          <span>{SCHOOL.name}</span>
          <span>Investigación · {SCHOOL.code}</span>
        </footer>
      </div>
      {dialog}
    </>
  );
}

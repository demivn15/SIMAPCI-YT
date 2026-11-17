/**
 * Pantalla de acceso de la ECMC (vista pública y fondo de /login), con el aspecto del
 * prototipo. El botón «Consultar sin iniciar sesión» se agregará con HU05, cuando exista
 * el listado público (/produccion).
 */
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
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
              <strong>SIMAPC</strong>
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

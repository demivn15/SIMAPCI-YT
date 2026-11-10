import React from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { getSchoolDisplayCode, SCHOOLS, type SchoolConfig } from '../../constants/schools';
import { YachayLogo } from './SchoolLogo';
import { ensureSchoolLogosDecoded, SCHOOL_LOGOS } from '../../assets/schoolLogos';

function SchoolSelectorMark({ school }: { school: SchoolConfig }) {
  return (
    <img
      className="school-selector-mark"
      src={SCHOOL_LOGOS[school.code]}
      alt=""
      width={76}
      height={76}
      draggable={false}
      style={{ width: 76, height: 76, aspectRatio: '1', flexShrink: 0, objectFit: 'contain', backgroundColor: '#fff' }}
    />
  );
}

export function SchoolSelector({ onSelect }: { onSelect: (school: SchoolConfig) => void }) {
  const [logosReady, setLogosReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    void ensureSchoolLogosDecoded().then((ready) => { if (mounted) setLogosReady(ready); });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="school-selector-page">
      <header className="school-selector-header">
        <a className="school-selector-brand" href="#inicio" aria-label="SIMAPC, inicio">
          <YachayLogo width={136} />
          <span>SIMAPC<small>Sistema de Información, Monitoreo y Administración de la Producción Científica</small></span>
        </a>
      </header>

      <main id="inicio" className="school-selector-main">
        <p className="school-selector-eyebrow">PORTAL DE INVESTIGACIÓN</p>
        <h1>Seleccione su escuela</h1>
        <p className="school-selector-intro">Consulte publicaciones, proyectos y líneas de investigación de la comunidad académica.</p>

        <section className="school-selector-grid" aria-label="Escuelas disponibles" aria-busy={!logosReady} style={{ visibility: logosReady ? 'visible' : 'hidden' }}>
          {SCHOOLS.map((school) => (
            <article className="school-selector-card" key={school.code} style={{ '--school-accent': school.accent, '--school-ink': `color-mix(in srgb, ${school.accent} 46%, #252321)`, '--accent': `color-mix(in srgb, ${school.accent} 46%, #252321)` } as React.CSSProperties}>
              <div className="school-selector-logo"><SchoolSelectorMark school={school} /></div>
              <span className="school-selector-code">{getSchoolDisplayCode(school.code)}</span>
              <h2>{school.name}</h2>
              <button type="button" className="school-selector-enter" onClick={() => onSelect(school)}>
                Ingresar a esta escuela <ArrowRight size={18} aria-hidden="true" />
              </button>
              <details className="school-selector-lines">
                <summary><span>Ver líneas de investigación</span><ChevronDown size={16} aria-hidden="true" /></summary>
                <ul>{school.researchLines.map((line) => <li key={line}>{line}</li>)}</ul>
              </details>
            </article>
          ))}
        </section>
      </main>

      <footer className="school-selector-footer">
        <span>SIMAPC · Universidad Yachay Tech</span>
      </footer>
    </div>
  );
}

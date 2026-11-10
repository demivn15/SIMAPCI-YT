import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Award, ChevronLeft, ChevronRight, ExternalLink, Pause, Play } from 'lucide-react';
import { SCHOOLS } from '../../constants/schools';
import { normalizeDoi } from '../../services/doiService';
import { OfficialResearchLine, ScientificProduct } from '../../types';
import { FeaturedPublicationBackdrop, ResearchTheme } from './FeaturedPublicationBackdrop';
import { ResearchLineBackdrop } from './ResearchLineBackdrop';
import { productCitationValue, productCitationLabel, productStatusLabel } from '../../services/productPresentation';

const numberFormat = new Intl.NumberFormat('es-EC');
const ROTATION_MS = 5000;

const ECMC_RESEARCH_THEMES: Partial<Record<OfficialResearchLine, ResearchTheme>> = {
  'Ecuaciones diferenciales, análisis matemático, modelamiento y optimización': 'mathematics',
  'Ciencia de datos': 'data',
  'Computación científica': 'computing',
  'Inteligencia artificial': 'artificial-intelligence',
  'Tecnologías de la información': 'technology',
  'Ciencia, Tecnología y Sociedad': 'society',
};

/** Anima el número sin movimiento si la persona prefiere reducirlo. */
function useCountUp(value: number, resetKey: string | undefined) {
  const [shown, setShown] = useState(value);

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    setShown(0);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 750);
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value, resetKey]);

  return shown;
}

export function getMostCitedByResearchLine(products: ScientificProduct[], researchLines: readonly OfficialResearchLine[]) {
  const topByLine = new Map<OfficialResearchLine, ScientificProduct>();

  products.forEach((product) => {
    if (product.type !== 'publicacion' || product.status !== 'verificado' || !product.researchLine) return;
    if (!researchLines.includes(product.researchLine)) return;

    // Unknown citation counts cannot be ranked against verified counts.
    const citations = productCitationValue(product);
    if (citations === null || !Number.isFinite(citations)) return;

    const current = topByLine.get(product.researchLine);
    const currentCitations = current ? productCitationValue(current) : null;
    if (!current || citations > (currentCitations ?? -1)
      || (citations === currentCitations && (product.year > current.year
        || (product.year === current.year && product.title.localeCompare(current.title) < 0)))) {
      topByLine.set(product.researchLine, product);
    }
  });

  return researchLines
    .map((line) => topByLine.get(line))
    .filter((product): product is ScientificProduct => Boolean(product))
    .sort((a, b) => (productCitationValue(b) ?? -1) - (productCitationValue(a) ?? -1)
      || b.year - a.year || a.title.localeCompare(b.title));
}

export function FeaturedPublicationCarousel({ products, researchLines }: { products: ScientificProduct[]; researchLines: readonly OfficialResearchLine[] }) {
  const publications = useMemo(() => getMostCitedByResearchLine(products, researchLines), [products, researchLines]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pauseForReducedMotion = (event: MediaQueryListEvent) => {
      if (event.matches) setPaused(true);
    };

    motionPreference.addEventListener('change', pauseForReducedMotion);
    return () => motionPreference.removeEventListener('change', pauseForReducedMotion);
  }, []);

  useEffect(() => {
    if (publications.length < 2 || paused || focused) return;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % publications.length);
    }, ROTATION_MS);

    return () => window.clearInterval(timer);
  }, [activeIndex, focused, paused, publications.length]);

  useEffect(() => {
    setActiveIndex((index) => publications.length ? index % publications.length : 0);
  }, [publications.length]);

  const currentIndex = publications.length ? activeIndex % publications.length : 0;
  const publication = publications[currentIndex];
  const citationValue = publication ? productCitationValue(publication) : null;
  const citationsShown = useCountUp(citationValue ?? 0, publication?.id);
  const canRotate = publications.length > 1;
  const running = canRotate && !paused && !focused;

  if (!publications.length) {
    return (
      <section className="featured-publications" aria-labelledby="featured-publications-title">
        <header className="featured-publications-heading">
          <div>
            <h2 id="featured-publications-title">Publicaciones con mayor repercusión</h2>
          </div>
        </header>
        <div className="featured-paper-empty">Aún no hay publicaciones verificadas para destacar.</div>
      </section>
    );
  }

  const school = SCHOOLS.find((candidate) => candidate.code === publication.school);
  const ecmcTheme = school?.code === 'ECMC' && publication.researchLine ? ECMC_RESEARCH_THEMES[publication.researchLine] : undefined;
  const cleanDoi = normalizeDoi(publication.doi);
  const goTo = (offset: number) => {
    setActiveIndex((index) => (index + offset + publications.length) % publications.length);
  };

  return (
    <section className="featured-publications" aria-labelledby="featured-publications-title">
      <header className="featured-publications-heading">
        <div>
          <h2 id="featured-publications-title">Publicaciones con mayor repercusión</h2>
        </div>
        <span className="featured-publications-selection"><Award size={16} aria-hidden="true" />Selección por citas registradas</span>
      </header>

      <div
        className="featured-paper-card"
        data-school={school?.code}
        onFocusCapture={(event) => {
          if ((event.target as HTMLElement).matches(':focus-visible')) setFocused(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
      >
        {ecmcTheme ? (
          <FeaturedPublicationBackdrop key={`backdrop-${publication.researchLine}`} theme={ecmcTheme} />
        ) : publication.researchLine ? (
          <ResearchLineBackdrop key={`backdrop-${publication.researchLine}`} researchLine={publication.researchLine} />
        ) : null}
        <div className="featured-paper-copy" key={publication.id}>
          <p className="eyebrow">PUBLICACIÓN DESTACADA</p>
          <p className="featured-paper-line">
            <span className="featured-paper-line-dot" aria-hidden="true" />
            {publication.researchLine || 'Línea no asignada'}
            {publication.bibliographicSource?.researchLineClassification
              ? ' · Sugerencia temporal'
              : publication.bibliographicSource ? ` · ${productStatusLabel(publication)}` : ''}
          </p>
          <h3>{publication.title}</h3>
          <p className="featured-paper-authors">{publication.authors.join(' · ')}</p>
          <p className="featured-paper-meta">
            {publication.year}{publication.venue ? ` · ${publication.venue}` : ''}
          </p>
          {cleanDoi && (
            <div className="featured-paper-actions">
              <a
                className="featured-paper-link"
                href={`https://doi.org/${cleanDoi}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir publicación <ExternalLink size={15} aria-hidden="true" />
              </a>
              <span className="featured-paper-doi">DOI {cleanDoi}</span>
            </div>
          )}
        </div>

        <aside className="featured-paper-citations" aria-label={citationValue === null ? 'Citas: No disponible' : `${productCitationLabel(publication)} citas registradas`}>
          <span>IMPACTO REGISTRADO</span>
          <strong>{citationValue === null ? '—' : numberFormat.format(citationsShown)}</strong>
          <span>{citationValue === null ? 'No disponible' : 'citas registradas'}</span>
          <div className="featured-paper-rank"><Award size={16} aria-hidden="true" />La más citada de esta línea</div>
        </aside>

        <div className="featured-paper-controls" role="group" aria-label="Controles de publicaciones destacadas">
          <button type="button" onClick={() => goTo(-1)} aria-label="Mostrar publicación anterior">
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <div className="featured-paper-dots" role="group" aria-label="Elegir publicación destacada">
            {publications.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={index === currentIndex ? 'selected' : ''}
                aria-label={`Mostrar: ${item.title}`}
                aria-pressed={index === currentIndex}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
          <button type="button" onClick={() => goTo(1)} aria-label="Mostrar siguiente publicación">
            <ChevronRight size={19} aria-hidden="true" />
          </button>
          {canRotate && (
            <button
              type="button"
              className="featured-paper-pause"
              onClick={() => {
                setPaused((value) => !value);
                setFocused(false);
              }}
              aria-pressed={paused}
              aria-label={paused ? 'Reanudar la rotación automática' : 'Pausar la rotación automática'}
              title={paused ? 'Reanudar' : 'Pausar'}
            >
              {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
            </button>
          )}
        </div>

        {running && (
          <span
            className="featured-paper-progress"
            key={`progress-${publication.id}`}
            style={{ animationDuration: `${ROTATION_MS}ms` }}
            aria-hidden="true"
          />
        )}
      </div>
    </section>
  );
}

/**
 * Cómo leer los indicadores (/guia): explicación breve, en lenguaje simple, de cada medida que
 * muestra el portal, de dónde salen los datos y sus limitaciones. Las definiciones de las
 * centralidades son las mismas de la ficha del profesor (utils/networkFormat.js).
 */
import { useQuery } from '@tanstack/react-query';
import { getMetricsOverview } from '../services/metricsService';
import { CENTRALITY_INFO } from '../utils/networkFormat';

const dateFormat = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });

const NETWORK_KEYS = ['betweenness', 'degree', 'strength', 'closeness', 'eigenvector', 'clustering', 'community'];

function GuideSection({ id, title, children }) {
  return (
    <section className="metrics-section analysis-guide-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export default function IndicatorsGuidePage() {
  const overview = useQuery({ queryKey: ['metrics', 'overview', {}], queryFn: () => getMetricsOverview({}) });
  const asOf = overview.data?.data_as_of ? dateFormat.format(new Date(overview.data.data_as_of)) : null;

  return (
    <>
      <header className="catalog-intro metrics-intro">
        <h1 className="display">Cómo leer los indicadores</h1>
        <p>Qué mide cada cifra del portal, de dónde sale y qué no dice.</p>
      </header>

      <div className="metrics-body analysis-guide">
        <GuideSection id="guide-h" title="Índice h">
          <p>
            Un profesor (o la Escuela) tiene índice <strong>h</strong> si <strong>h</strong> de sus obras tienen al menos{' '}
            <strong>h</strong> citas cada una. Por ejemplo, h = 10 significa que hay 10 obras con 10 citas o más.
          </p>
          <p>
            Aquí se calcula con su definición estándar a partir de las <strong>citas conocidas</strong>. Por eso puede
            diferir del índice h de Google Scholar o Scopus, que usan otras bases de citas.
          </p>
        </GuideSection>

        <GuideSection id="guide-unknown" title="Citas desconocidas no son cero">
          <p>
            Si no se encontró una obra en OpenAlex, no sabemos cuántas veces fue citada: queda como{' '}
            <strong>desconocida</strong>, no como 0. Un 0 afirmaría que nadie la citó. Las citas desconocidas no suman a
            los totales ni al índice h, y las pantallas indican cuántas obras tienen citas conocidas.
          </p>
        </GuideSection>

        <GuideSection id="guide-quartile" title="Cuartil SJR e índice h de la revista">
          <p>
            SCImago ordena las revistas de cada área según su influencia (SJR) y las divide en cuatro partes:{' '}
            <strong>Q1</strong> es el 25 % más alto y <strong>Q4</strong> el 25 % más bajo. El cuartil es de la{' '}
            <strong>revista o congreso</strong>, no de la obra. «Sin cuartil SJR» significa que la revista no está en
            SCImago (por ejemplo, muchos capítulos de libro o congresos).
          </p>
          <p>
            El <strong>índice h de la revista</strong> que entrega SCImago describe a la revista, no al profesor. El índice
            h del profesor se calcula aparte, con sus propias obras.
          </p>
        </GuideSection>

        <GuideSection id="guide-network" title="Medidas de la red de coautoría">
          <p>
            Cada profesor es un punto y dos profesores quedan unidos si han publicado juntos; la unión es más fuerte cuantas
            más obras compartan.
          </p>
          <dl className="analysis-guide-list">
            {NETWORK_KEYS.map((key) => (
              <div key={key}>
                <dt>{CENTRALITY_INFO[key].label}</dt>
                <dd>
                  {CENTRALITY_INFO[key].short} <em>Ejemplo: {CENTRALITY_INFO[key].example}</em>
                </dd>
              </div>
            ))}
            <div>
              <dt>Modularidad</dt>
              <dd>
                Qué tan marcada es la división de la red en comunidades. Por encima de 0,3 suele indicar grupos claros.{' '}
                <em>Ejemplo: en una fiesta donde cada mesa casi no habla con las demás, la modularidad es alta.</em>
              </dd>
            </div>
            <div>
              <dt>Densidad</dt>
              <dd>
                Proporción de parejas de profesores que han publicado juntas, de todas las parejas posibles.{' '}
                <em>Ejemplo: en un curso de 30 personas, cuántas de las parejas posibles ya hicieron un trabajo juntas.</em>
              </dd>
            </div>
          </dl>
          <p>
            Una centralidad alta no es mejor ni peor: describe una posición en la red. Los valores dependen de los filtros
            elegidos y solo consideran a los profesores de la Escuela.
          </p>
        </GuideSection>

        <GuideSection id="guide-affiliation" title="«Afiliación Yachay»">
          <p>
            Una obra tiene afiliación Yachay cuando el profesor firmó como miembro de la Universidad Yachay Tech (según
            OpenAlex o la verificación manual del volcado). Con el filtro «Solo con afiliación Yachay» se ven solo esas
            obras; «Trayectoria completa» incluye también lo que el profesor publicó en otras instituciones antes o
            fuera de Yachay Tech.
          </p>
        </GuideSection>

        <GuideSection id="guide-sources" title="De dónde salen los datos">
          <ul className="analysis-guide-bullets">
            <li>
              <strong>ORCID</strong>: lista de obras de cada profesor.
            </li>
            <li>
              <strong>OpenAlex</strong>: citas, instituciones, países, acceso abierto y tipo de obra.
            </li>
            <li>
              <strong>Crossref</strong>: metadatos por DOI, tipo de obra y citas de respaldo.
            </li>
            <li>
              <strong>SCImago</strong>: cuartil SJR e índice h de la revista.
            </li>
          </ul>
          <p>
            Solo cuentan las obras <strong>verificadas</strong>; las que están cargadas o rechazadas no suman.
            {asOf ? ` Fecha de corte de los datos: ${asOf}.` : ''}
          </p>
        </GuideSection>

        <GuideSection id="guide-limits" title="Limitaciones">
          <ul className="analysis-guide-bullets">
            <li>
              <strong>Lista de autores incompleta</strong>: el volcado solo incluye a los profesores de la Escuela como
              autores. Por eso la colaboración externa se mide por institución y país, no por persona.
            </li>
            <li>
              <strong>Líneas de investigación provisionales</strong>: las obras importadas se clasificaron por palabras
              clave del título y del área SCImago, y deben revisarse.
            </li>
            <li>
              <strong>Tipos de obra sin unificar</strong>: se muestran como llegan de Crossref/OpenAlex; «artículo» y
              «artículo de revista» pueden referirse a lo mismo.
            </li>
            <li>
              Una obra en coautoría entre profesores de la Escuela cuenta para cada uno de ellos, pero una sola vez en los
              totales de la Escuela.
            </li>
          </ul>
        </GuideSection>
      </div>
    </>
  );
}

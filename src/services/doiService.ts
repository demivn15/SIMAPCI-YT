import { OfficialResearchLine, AcademicSemester } from '../types';

export interface ExtractedPublicationMetadata {
  simulated: boolean;
  title: string;
  authors: string[];
  year: number;
  semester: AcademicSemester;
  venue: string;
  doi: string;
  abstract: string;
  researchLine?: OfficialResearchLine;
}

export interface OrcidWorkItem {
  simulated: boolean;
  id: string;
  title: string;
  year: number;
  venue: string;
  doi?: string;
  type: string;
  researchLine: OfficialResearchLine;
  abstract: string;
}

/**
 * Normaliza un DOI a formato estándar en minúsculas sin prefijos URL
 * Ej: "https://doi.org/10.1145/3576915" -> "10.1145/3576915"
 */
export function normalizeDoi(rawDoi?: string): string {
  if (!rawDoi) return '';
  return rawDoi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/\/+$/, '');
}

/**
 * Normaliza códigos de proyecto
 * Ej: " ecmc-inv-2024-008 " -> "ECMC-INV-2024-008"
 */
export function normalizeProjectCode(rawCode?: string): string {
  if (!rawCode) return '';
  return rawCode.trim().toUpperCase().replace(/\s+/g, '-');
}

/** Tiempo máximo de espera de la consulta a Crossref antes de abandonarla. */
export const DOI_LOOKUP_TIMEOUT_MS = 8000;

export type DoiLookupErrorCode = 'invalid' | 'not_found' | 'timeout' | 'unavailable' | 'network';

export interface DoiLookupResult {
  success: boolean;
  data?: ExtractedPublicationMetadata;
  error?: string;
  errorCode?: DoiLookupErrorCode;
}

function lookupFailure(errorCode: DoiLookupErrorCode, doi = ''): DoiLookupResult {
  const messages: Record<DoiLookupErrorCode, string> = {
    invalid: 'Por favor ingresa un identificador DOI válido.',
    not_found: `No se encontraron metadatos en línea para el DOI "${doi}". Puedes completar los datos manualmente o revisar que el identificador sea correcto.`,
    timeout: 'El servicio de metadatos (Crossref) tardó demasiado en responder. Puedes reintentar o completar los datos manualmente.',
    unavailable: 'El servicio de metadatos (Crossref) no está disponible en este momento. Puedes reintentar más tarde o completar los datos manualmente.',
    network: 'No fue posible conectar con el servicio de metadatos. Revisa tu conexión a internet o completa los datos manualmente.',
  };
  return { success: false, error: messages[errorCode], errorCode };
}

export const doiService = {
  /**
   * Resuelve metadatos bibliográficos a partir de un DOI
   */
  async resolveDoi(rawDoi: string): Promise<DoiLookupResult> {
    const cleanDoi = normalizeDoi(rawDoi);
    if (!cleanDoi) return lookupFailure('invalid');

    // 1. Catálogo de demostración precargado de respuesta inmediata
    const KNOWN_MOCKS: Record<string, ExtractedPublicationMetadata> = {
      '10.1145/3576915.3623102': {
        simulated: true,
        title: 'Lattice-Based Zero-Knowledge Cryptographic Proofs for Decentralized Academic Credential Verification',
        authors: ['Roberto Cárdenas Guanoluisa', 'Juan Pablo Astudillo León'],
        year: 2025,
        semester: '2025-1',
        venue: 'ACM Conference on Computer and Communications Security (CCS)',
        doi: '10.1145/3576915.3623102',
        abstract: 'A post-quantum verification protocol with succinct proofs protecting student identity and diploma veracity under NIST round 4 post-quantum standards.',
        researchLine: 'Tecnologías de la información',
      },
      '10.1038/s42003-024-06122-8': {
        simulated: true,
        title: 'Deep Residual Learning for Genomic Variant Classification in High-Altitude Populations',
        authors: ['Sofía Arcentales Mora', 'Elena Valdivieso Castro'],
        year: 2024,
        semester: '2024-2',
        venue: 'Nature Communications Biology, Vol. 15, No. 3',
        doi: '10.1038/s42003-024-06122-8',
        abstract: 'Machine learning architectures tuned for small-sample genetic sequences from andean communities, identifying metabolic variants associated with chronic hypoxia adaptation.',
        researchLine: 'Ciencia de datos',
      },
      '10.1016/j.cam.2023.114920': {
        simulated: true,
        title: 'Finite Element Simulation of Magnetohydrodynamic Convection in Porous Nanofluids',
        authors: ['Carlos Mendoza Paredes'],
        year: 2024,
        semester: '2024-1',
        venue: 'Journal of Computational and Applied Mathematics, Vol. 412',
        doi: '10.1016/j.cam.2023.114920',
        abstract: 'Analysis of non-linear Darcy-Forchheimer flow models with variable thermal conductivity using stabilized Petrov-Galerkin formulations.',
        researchLine: 'Ecuaciones diferenciales, análisis matemático, modelamiento y optimización',
      },
      '10.1109/tevc.2023.3298411': {
        simulated: true,
        title: 'Hybrid Metaheuristic Approaches for Large-Scale Vehicle Routing in Mountainous Topographies',
        authors: ['Juan Pablo Astudillo León', 'Carlos Mendoza Paredes'],
        year: 2024,
        semester: '2024-1',
        venue: 'IEEE Transactions on Evolutionary Computation, Vol. 28, No. 2',
        doi: '10.1109/TEVC.2023.3298411',
        abstract: 'A bi-objective genetic local search algorithm optimizing fuel consumption and elevation ascent constraints across complex Ecuadorian andean routes.',
        researchLine: 'Computación científica',
      },
    };

    if (KNOWN_MOCKS[cleanDoi]) {
      return { success: true, data: KNOWN_MOCKS[cleanDoi] };
    }

    // 2. Consulta real a CrossRef Public API con tiempo de espera y errores diferenciados
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, DOI_LOOKUP_TIMEOUT_MS);

    try {
      const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (response.ok) {
        let item;
        try {
          item = (await response.json()).message;
        } catch {
          item = undefined;
        }
        if (!item || typeof item !== 'object') return lookupFailure('unavailable');
        const title = item.title?.[0] || 'Publicación sin título';
        const authors = (item.author || []).map((a: { given?: string; family?: string; name?: string }) =>
          a.given && a.family ? `${a.given} ${a.family}` : a.name || 'Autor Desconocido'
        );
        const year = item.published?.['date-parts']?.[0]?.[0] || new Date().getFullYear();
        const month = item.published?.['date-parts']?.[0]?.[1] || 1;
        const semester: AcademicSemester = month <= 6 ? `${year}-1` as AcademicSemester : `${year}-2` as AcademicSemester;
        const venue = item['container-title']?.[0] || item.publisher || 'Revista científica';
        const abstract = item.abstract ? item.abstract.replace(/<[^>]+>/g, '') : 'Resumen no provisto por el proveedor de metadatos.';

        return {
          success: true,
          data: {
            simulated: false,
            title,
            authors: authors.length > 0 ? authors : ['Investigador de Yachay Tech'],
            year,
            semester,
            venue,
            doi: cleanDoi,
            abstract,
            researchLine: 'Tecnologías de la información',
          },
        };
      }

      // 429 y 5xx: el servicio existe pero no puede atender la consulta ahora
      if (response.status === 429 || response.status >= 500) return lookupFailure('unavailable');
      return lookupFailure('not_found', cleanDoi);
    } catch {
      // El tiempo de espera aborta la petición; cualquier otro fallo es de red
      return lookupFailure(timedOut ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * Simula consulta a API de ORCID para listar publicaciones del autor
   */
  async searchByOrcid(orcid: string): Promise<OrcidWorkItem[]> {
    const cleanOrcid = orcid.trim();
    // Obras simuladas asociadas al perfil ORCID institucional
    return [
      {
        id: 'work-1',
        simulated: true,
        title: 'Distributed Consensus Algorithms for Decentralized Edge Analytics in Ecuador',
        year: 2025,
        venue: 'IEEE Latin America Transactions',
        doi: '10.1109/TLA.2025.1092834',
        type: 'publicacion',
        researchLine: 'Tecnologías de la información',
        abstract: 'Experimental validation of gossip protocols tailored for high-latency inter-university networks in the northern Sierra region.',
      },
      {
        id: 'work-2',
        simulated: true,
        title: 'Topological Data Analysis for High-Dimensional Biosensor Clustering',
        year: 2024,
        venue: 'Journal of Mathematical Biology & Systems',
        doi: '10.1007/s00285-024-02108-x',
        type: 'publicacion',
        researchLine: 'Ecuaciones diferenciales, análisis matemático, modelamiento y optimización',
        abstract: 'Persistent homology signatures applied to multi-sensor physiological telemetry time series.',
      },
      {
        id: 'work-3',
        simulated: true,
        title: 'Proyecto: Red Telemática Abierta para Monitoreo Ambiental de Alta Montaña',
        year: 2025,
        venue: 'Fondo de Cooperación Científica ECMC',
        doi: '',
        type: 'proyecto',
        researchLine: 'Ciencia de datos',
        abstract: 'Despliegue experimental de nodos LoRaWAN con balanceo energético solar en páramos andinos.',
      },
    ];
  },
};

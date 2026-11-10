import sourcePublications from '../data/ecmc-orcid.json';
import type { ScientificProduct, TeacherUser } from '../types';
import { ECMC_RESEARCH_DICTIONARY_VERSION, suggestEcmcResearchLine } from '../services/ecmcResearchLineDictionary';

export const ECMC_ORCID_DATASET = 'emcc_orcid.sql';
// Ingestion time; this is not a publication date or an institutional review date.
export const ECMC_ORCID_IMPORTED_AT = '2026-10-13T22:52:12Z';

const researcherId = (orcid: string) => `ecmc-orcid-researcher-${orcid}`;
const researchers = new Map<string, { name: string; orcid: string }>();
for (const publication of sourcePublications) {
  for (const researcher of publication.researchers) {
    researchers.set(researcher.orcid, researcher);
  }
}

// Only the names and ORCID identifiers explicitly present in the supplied source.
// Empty required fields do not assert an email, institutional rank or degree.
export const INITIAL_TEACHERS: TeacherUser[] = [...researchers.values()].map(researcher => ({
  id: researcherId(researcher.orcid),
  name: researcher.name,
  orcid: researcher.orcid,
  email: '',
  rank: '',
  researchLines: [],
  school: 'ECMC',
  role: 'teacher',
  createdAt: ECMC_ORCID_IMPORTED_AT,
}));

export const INITIAL_PRODUCTS: ScientificProduct[] = sourcePublications.map(publication => {
  const lineSuggestion = suggestEcmcResearchLine(publication.title);
  return {
    id: publication.id,
    type: 'publicacion',
    title: publication.title,
    authors: publication.researchers.map(researcher => researcher.name),
    authorIds: publication.researchers.map(researcher => researcherId(researcher.orcid)),
    // An ORCID association does not identify an owner or the publication's first author.
    ownerId: 'ecmc-orcid-import',
    school: 'ECMC',
    year: publication.year,
    researchLine: lineSuggestion?.line || '',
    abstract: '',
    // Public import visibility only. The UI identifies these as imported ORCID
    // records, not an approval by the scientific committee; verifiedAt stays absent.
    status: 'verificado',
    citations: publication.citations ?? 0,
    doi: publication.doi || undefined,
    venue: publication.venue || undefined,
    createdAt: ECMC_ORCID_IMPORTED_AT,
    updatedAt: ECMC_ORCID_IMPORTED_AT,
    bibliographicSource: {
      dataset: ECMC_ORCID_DATASET,
      publicationType: publication.publicationType,
      researcherOrcids: publication.researchers.map(researcher => researcher.orcid),
      sourceRows: publication.sourceRows,
      citations: publication.citations,
      sjrQuartile: publication.sjrQuartile,
      sjrScore: publication.sjrScore,
      researchLineClassification: lineSuggestion ? {
        method: 'temporary-keyword-dictionary',
        version: ECMC_RESEARCH_DICTIONARY_VERSION,
        strength: lineSuggestion.strength,
        matchedKeywords: lineSuggestion.matchedKeywords,
      } : undefined,
    },
  };
});

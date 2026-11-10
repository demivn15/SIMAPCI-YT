import { SCHOOLS, type OfficialResearchLine, type SchoolCode } from './schools';

export interface ResearchStageSlide {
  readonly title: string;
  readonly line: OfficialResearchLine;
  readonly accentWords: readonly number[];
}

/** One existing SVG motif accompanies each school presentation. */
const SCHOOL_STAGE_MOTIFS: Record<SchoolCode, OfficialResearchLine> = {
  ECIAA: 'Ciencias Agrícolas',
  ECBI: 'Biología celular, biología molecular y genética',
  ECFN: 'Materiales nanoestructurados, síntesis y caracterización',
  ECTEA: 'Geomática aplicada a las geociencias',
  ECMC: 'Inteligencia artificial',
  ECQI: 'Química medicinal y farmacología molecular',
  YTLC: 'Sociolinguistics/Language and Culture',
};

/** School names share the official configuration; each school has exactly one slide. */
export const RESEARCH_STAGE_SLIDES = SCHOOLS.reduce((slides, school) => {
  slides[school.code] = [{
    title: school.name,
    line: SCHOOL_STAGE_MOTIFS[school.code],
    accentWords: school.name.split(' ').flatMap((_, index) =>
      index >= (school.code === 'YTLC' ? 0 : 3) ? [index] : [],
    ),
  }];
  return slides;
}, {} as Record<SchoolCode, readonly [ResearchStageSlide]>);

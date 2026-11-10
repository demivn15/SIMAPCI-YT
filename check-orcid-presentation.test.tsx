import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { OfficialResearchLine, ScientificProduct, TeacherUser } from './src/types';
import { metricsService } from './src/services/metricsService';
import { productCitationLabel, productCitationValue, productMatchesTeacher, productStatusLabel } from './src/services/productPresentation';
import { ProductDetailModal } from './src/components/catalog/ProductDetailModal';
import { FeaturedPublicationCarousel, getMostCitedByResearchLine } from './src/components/dashboard/FeaturedPublicationCarousel';
import { SCHOOLS } from './src/constants/schools';

const imported: ScientificProduct = {
  id: 'orcid-work-test', type: 'publicacion', title: 'Trabajo importado', authors: ['Investigadora asociada'],
  authorIds: ['orcid-researcher-test'], ownerId: 'ecmc-orcid-import', school: 'ECMC', year: 2011,
  researchLine: '', abstract: '', status: 'verificado', citations: 0,
  createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z',
  bibliographicSource: { dataset: 'emcc_orcid.sql', publicationType: 'journal-article', researcherOrcids: ['0000-0001-0000-0000'], sourceRows: [1], citations: null, sjrQuartile: null, sjrScore: null },
};
const teacher: TeacherUser = { id: 'orcid-researcher-test', name: 'Nombre de perfil', email: '', rank: '', role: 'teacher', school: 'ECMC', createdAt: '2026-10-13' };

describe('presentación factual de registros ORCID', () => {
  it('distingue importación, revisión institucional y citas desconocidas', () => {
    expect(productStatusLabel(imported)).toBe('Importado (ORCID)');
    expect(productStatusLabel({ ...imported, verifiedAt: '2026-10-14T00:00:00Z' })).toBe('Verificado');
    expect(productCitationValue(imported)).toBeNull();
    expect(productCitationLabel(imported)).toBe('No disponible');
    expect(productCitationLabel({ ...imported, bibliographicSource: { ...imported.bibliographicSource!, citations: 0 } })).toBe('0');
  });

  it('usa la asociación explícita de autores y no atribuye productos por nombres parecidos', () => {
    expect(productMatchesTeacher(imported, teacher)).toBe(true);
    expect(productMatchesTeacher(imported, { ...teacher, id: 'otro', name: imported.authors[0] })).toBe(false);
    const local = { ...imported, bibliographicSource: undefined, authorIds: undefined, authors: ['Mariana'] };
    expect(productMatchesTeacher(local, { ...teacher, id: 'otro', name: 'Ana' })).toBe(false);
    expect(productMatchesTeacher({ ...local, authors: ['JOSÉ  PÉREZ'] }, { ...teacher, id: 'otro', name: 'José Pérez' })).toBe(true);
  });

  it('cuenta una publicación institucional y cada investigador asociado sin inventar línea ni semestre', () => {
    const coauthored = { ...imported, authorIds: [teacher.id, 'coautor'], bibliographicSource: { ...imported.bibliographicSource!, citations: 12 } };
    expect(metricsService.calculateSchoolMetrics([coauthored])).toMatchObject({ totalPublications: 1, totalCitations: 12, researchLinesWithProduction: 0 });
    expect(metricsService.calculateTeacherMetrics(teacher, [coauthored]).publicationsCount).toBe(1);
    expect(metricsService.calculateTeacherMetrics({ ...teacher, id: 'coautor' }, [coauthored]).publicationsCount).toBe(1);
    const annual = metricsService.getTemporalEvolutionData([imported, { ...coauthored, id: '2027-work', year: 2027 }]);
    expect(annual[0]).toMatchObject({ semester: '2011', unit: 'year', publications: 1 });
    expect(annual.at(-1)).toMatchObject({ semester: '2027', unit: 'year', publications: 1 });
    expect(annual.reduce((sum, point) => sum + point.total, 0)).toBe(2);
  });

  it('mantiene la serie semestral de las otras seis escuelas', () => {
    for (const school of SCHOOLS.filter(school => school.code !== 'ECMC')) {
      const product = { ...imported, bibliographicSource: undefined, school: school.code, researchLine: school.researchLines[0], year: 2025, publicationDate: '2025-07-01' };
      const series = metricsService.getTemporalEvolutionData([product]);
      expect(series).toHaveLength(12);
      expect(series.find(point => point.semester === '2025-2')?.publications).toBe(1);
      expect(series.some(point => point.unit === 'year')).toBe(false);
    }
  });

  it('muestra la fuente sin certificar al comité ni convertir citas ausentes en cero', () => {
    const detail = renderToStaticMarkup(<ProductDetailModal product={imported} onClose={() => {}} />);
    expect(detail).toContain('Importado (ORCID)');
    expect(detail).toContain('No disponible');
    expect(detail).toContain('Línea no asignada');
    expect(detail).toContain('compruebe la autoría completa en el DOI antes de citar');
    expect(detail).not.toContain('Certificado');
    const carousel = renderToStaticMarkup(<FeaturedPublicationCarousel products={[imported]} researchLines={SCHOOLS.find(school => school.code === 'ECMC')!.researchLines} />);
    expect(carousel).toContain('Aún no hay publicaciones verificadas para destacar.');
    expect(carousel).not.toContain(imported.title);
  });

  it('destaca solo la publicación más citada de cada línea, incluidas las citas ORCID', () => {
    const lines = SCHOOLS.find(school => school.code === 'ECMC')!.researchLines;
    const lineOne = lines[0];
    const lineTwo = lines[1];
    const makeProduct = (id: string, researchLine: OfficialResearchLine | '', citations: number, year = 2024): ScientificProduct => ({
      ...imported,
      id,
      title: id,
      researchLine,
      citations: 0,
      year,
      bibliographicSource: { ...imported.bibliographicSource!, citations },
    });
    const products = [
      makeProduct('local-line-one', lineOne, 9),
      makeProduct('orcid-line-one-winner', lineOne, 24),
      makeProduct('orcid-line-one-runner-up', lineOne, 18),
      makeProduct('line-two-winner', lineTwo, 12),
      makeProduct('unassigned-high-count', '', 99),
      { ...makeProduct('unknown-citations', lineTwo, 0), bibliographicSource: { ...imported.bibliographicSource!, citations: null } },
      { ...makeProduct('rejected-high-count', lineTwo, 100), status: 'rechazado' as const },
    ];

    const featured = getMostCitedByResearchLine(products, lines);

    expect(featured.map(product => product.id)).toEqual(['orcid-line-one-winner', 'line-two-winner']);
    expect(new Set(featured.map(product => product.researchLine)).size).toBe(featured.length);
  });
});

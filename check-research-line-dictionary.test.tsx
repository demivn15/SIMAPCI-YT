import { describe, expect, it } from 'vitest';
import { OFFICIAL_RESEARCH_LINES } from './src/constants/researchLines';
import { INITIAL_PRODUCTS } from './src/constants/ecmcOrcidData';
import { INITIAL_SCHOOL_PRODUCTS } from './src/constants/schoolSeedData';
import { suggestEcmcResearchLine } from './src/services/ecmcResearchLineDictionary';
import { storageService, STORAGE_KEYS } from './src/services/storage';

describe('diccionario temporal de líneas ECMC', () => {
  it('detecta temas claros en títulos en inglés y español', () => {
    expect(suggestEcmcResearchLine('A Study of ConvNeXt Architectures for Enhanced Image Captioning')?.line)
      .toBe('Inteligencia artificial');
    expect(suggestEcmcResearchLine('Análisis de ecuaciones diferenciales parciales y modelamiento matemático')?.line)
      .toBe('Ecuaciones diferenciales, análisis matemático, modelamiento y optimización');
    expect(suggestEcmcResearchLine('Reflexiones sobre justicia social y filosofía de la educación')?.line)
      .toBe('Ciencia, Tecnología y Sociedad');
    expect(suggestEcmcResearchLine('Artificial Intelligence in 5G Technology: A Survey')?.line)
      .toBe('Inteligencia artificial');
  });

  it('no asigna una línea cuando el título no ofrece evidencia suficiente', () => {
    expect(suggestEcmcResearchLine('A study of interdisciplinary questions in modern research')).toBeUndefined();
  });

  it('solo añade sugerencias a publicaciones importadas de ECMC y conserva líneas oficiales', () => {
    const imported = INITIAL_PRODUCTS.filter(product => product.bibliographicSource);
    expect(imported).toHaveLength(135);
    expect(imported.every(product => product.school === 'ECMC')).toBe(true);
    const suggestions = imported.filter(product => product.bibliographicSource?.researchLineClassification);
    expect(suggestions.length).toBeGreaterThan(70);
    expect(suggestions.length).toBeLessThan(imported.length);
    for (const product of imported) {
      if (!product.bibliographicSource?.researchLineClassification) continue;
      expect(OFFICIAL_RESEARCH_LINES).toContain(product.researchLine);
      expect(product.bibliographicSource.researchLineClassification.method).toBe('temporary-keyword-dictionary');
    }
  });

  it('migra productos importados existentes, conserva asignaciones manuales y otros registros', () => {
    const suggestedProduct = INITIAL_PRODUCTS.find(product => product.bibliographicSource?.researchLineClassification)!;
    const formerlyUnassigned = INITIAL_PRODUCTS.find(product => product.title === 'Artificial Intelligence in 5G Technology: A Survey')!;
    const manuallyAssignedProduct = INITIAL_PRODUCTS.find(product =>
      product.id !== suggestedProduct.id && product.bibliographicSource?.researchLineClassification
        && product.researchLine !== OFFICIAL_RESEARCH_LINES[0]
    )!;
    const manuallyAssignedLine = OFFICIAL_RESEARCH_LINES[0];
    const priorImport = {
      ...suggestedProduct,
      researchLine: '',
      bibliographicSource: { ...suggestedProduct.bibliographicSource!, researchLineClassification: undefined },
    };
    const priorUnassigned = {
      ...formerlyUnassigned,
      researchLine: '',
      bibliographicSource: { ...formerlyUnassigned.bibliographicSource!, researchLineClassification: undefined },
    };
    const priorManual = {
      ...manuallyAssignedProduct,
      researchLine: manuallyAssignedLine,
      bibliographicSource: { ...manuallyAssignedProduct.bibliographicSource!, researchLineClassification: undefined },
    };
    const customProduct = {
      id: 'custom-ecmc-preserved', type: 'publicacion' as const, title: 'Registro manual', authors: ['Docente'],
      ownerId: 'custom-owner', school: 'ECMC', year: 2024, researchLine: '' as const, abstract: '',
      status: 'cargado' as const, createdAt: '2024-01-01', updatedAt: '2024-01-01', citations: 0,
    };
    const otherSchoolProduct = INITIAL_SCHOOL_PRODUCTS.find(product => product.school === 'ECTEA')!;
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([priorImport, priorUnassigned, priorManual, customProduct, otherSchoolProduct]));
    localStorage.setItem(STORAGE_KEYS.ECMC_ORCID_IMPORT, 'emcc-orcid-2026-10-13-lines-v1');

    const migrated = storageService.getProducts();
    expect(migrated.find(product => product.id === priorImport.id)?.researchLine).toBe(suggestedProduct.researchLine);
    expect(migrated.find(product => product.id === priorImport.id)?.bibliographicSource?.researchLineClassification?.method)
      .toBe('temporary-keyword-dictionary');
    expect(migrated.find(product => product.id === priorUnassigned.id)?.researchLine).toBe('Inteligencia artificial');
    expect(migrated.find(product => product.id === priorUnassigned.id)?.bibliographicSource?.researchLineClassification?.version)
      .toBe('ecmc-lines-v2');
    expect(migrated.find(product => product.id === priorManual.id)?.researchLine).toBe(manuallyAssignedLine);
    expect(migrated.find(product => product.id === priorManual.id)?.bibliographicSource?.researchLineClassification).toBeUndefined();
    expect(migrated.find(product => product.id === customProduct.id)).toEqual(customProduct);
    expect(migrated.find(product => product.id === otherSchoolProduct.id)).toEqual(otherSchoolProduct);
  });
});

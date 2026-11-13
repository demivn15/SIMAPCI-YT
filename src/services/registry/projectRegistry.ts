import { PUBLICATION_ONLY_FIELDS, RegistryModule, cleanNames, cleanText, omitFields, resolveSchool } from './registryCommon';

/** Módulo de registro de proyectos de investigación. No conoce reglas de publicaciones ni de una escuela concreta. */
export const projectRegistry: RegistryModule = {
  type: 'proyecto',

  prepare(input, owner) {
    const school = resolveSchool(input.school, owner);
    if (!school.success) return school;

    const title = input.title?.trim();
    if (!title) return { success: false, error: 'El título del proyecto es obligatorio.' };

    const authors = cleanNames(input.authors);
    if (!authors.length) return { success: false, error: 'Indique al menos un integrante del proyecto.' };

    // Las fechas ISO (AAAA-MM-DD) se comparan como texto.
    if (input.projectStartDate && input.projectEndDate && input.projectEndDate < input.projectStartDate) {
      return { success: false, error: 'La fecha de finalización del proyecto no puede ser anterior a la de inicio.' };
    }

    return {
      success: true,
      product: {
        ...omitFields(input, PUBLICATION_ONLY_FIELDS),
        type: 'proyecto',
        title,
        authors,
        school: school.school,
        projectCode: cleanText(input.projectCode),
        projectDirector: cleanText(input.projectDirector),
        fundingVenue: cleanText(input.fundingVenue),
        projectStatus: input.projectStatus ?? 'activo',
      },
    };
  },
};

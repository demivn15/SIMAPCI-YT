import { PROJECT_ONLY_FIELDS, RegistryModule, cleanNames, cleanText, omitFields, resolveSchool } from './registryCommon';

/** Módulo de registro de publicaciones científicas. No conoce reglas de proyectos ni de una escuela concreta. */
export const publicationRegistry: RegistryModule = {
  type: 'publicacion',

  prepare(input, owner) {
    const school = resolveSchool(input.school, owner);
    if (!school.success) return school;

    const title = input.title?.trim();
    if (!title) return { success: false, error: 'El título de la publicación es obligatorio.' };

    const authors = cleanNames(input.authors);
    if (!authors.length) return { success: false, error: 'Indique al menos un autor de la publicación.' };

    return {
      success: true,
      product: {
        ...omitFields(input, PROJECT_ONLY_FIELDS),
        type: 'publicacion',
        title,
        authors,
        school: school.school,
        doi: cleanText(input.doi),
        venue: cleanText(input.venue),
        volumeIssue: cleanText(input.volumeIssue),
      },
    };
  },
};

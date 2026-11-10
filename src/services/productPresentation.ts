import { ScientificProduct, TeacherUser, PRODUCT_STATUS_LABELS } from '../types';

export function productStatusLabel(product: ScientificProduct): string {
  return product.bibliographicSource && !product.verifiedAt && product.status === 'verificado'
    ? 'Importado (ORCID)'
    : PRODUCT_STATUS_LABELS[product.status];
}

export function productCitationValue(product: ScientificProduct): number | null {
  return product.bibliographicSource ? product.bibliographicSource.citations : product.citations;
}

export function productCitationLabel(product: ScientificProduct): string {
  const citations = productCitationValue(product);
  return citations === null ? 'No disponible' : String(citations);
}

const normalizedName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim().replace(/\s+/g, ' ');

export function productMatchesTeacher(product: ScientificProduct, teacher: TeacherUser): boolean {
  if (product.ownerId === teacher.id || product.authorIds?.includes(teacher.id)) return true;
  // An ORCID source supplies explicit researcher associations. Do not infer an
  // additional association from a similar or abbreviated author display name.
  if (product.authorIds) return false;
  const name = normalizedName(teacher.name);
  return !!name && product.authors.some(author => normalizedName(author) === name);
}

export function productDateLabel(product: ScientificProduct): string {
  const date = product.type === 'publicacion' ? product.publicationDate : product.projectStartDate;
  if (!date) return String(product.year);

  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? String(product.year)
    : parsed.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function productDateValue(product: ScientificProduct): string {
  return product.type === 'publicacion'
    ? product.publicationDate || String(product.year)
    : product.projectStartDate || String(product.year);
}

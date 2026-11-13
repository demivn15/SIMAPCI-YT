import type { ProductType, ScientificProduct } from '../../types';
import { getSchoolByCode } from '../../constants/schools';

/** Datos que aporta el formulario para registrar un producto; el servicio completa id, estado y fechas. */
export type RegistryInput = Omit<ScientificProduct, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'citations' | 'ownerId'>;

/** Persona responsable del registro; su escuela se usa solo cuando el formulario no indica otra. */
export interface RegistryOwner {
  id: string;
  school: string;
}

export type RegistryDraft = { success: true; product: RegistryInput } | { success: false; error: string };

/**
 * Contrato de cada módulo de registro. Los módulos no leen ni escriben almacenamiento:
 * validan y normalizan los datos de su tipo, y productService se encarga de persistir.
 */
export interface RegistryModule {
  readonly type: ProductType;
  prepare(input: RegistryInput, owner: RegistryOwner): RegistryDraft;
}

export const PUBLICATION_ONLY_FIELDS = ['publicationDate', 'doi', 'venue', 'volumeIssue', 'articleAttachment', 'privacyConsentAt'] as const;

export const PROJECT_ONLY_FIELDS = [
  'projectStartDate', 'projectEndDate', 'projectCode', 'projectDirector', 'fundingVenue', 'projectStatus',
  'projectParticipants', 'projectDurationMonths', 'expectedProducts', 'projectProgressReports', 'projectClosureReport',
] as const;

export const cleanText = (value?: string) => value?.trim() || undefined;

export const cleanNames = (values?: string[]) => (values ?? []).map(value => value.trim()).filter(Boolean);

export function omitFields<T extends object>(source: T, keys: readonly string[]): T {
  const copy = { ...source } as Record<string, unknown>;
  for (const key of keys) delete copy[key];
  return copy as T;
}

/**
 * La escuela es un dato obligatorio del registro: no existe una escuela por defecto.
 * Si el formulario no la indica se usa la del responsable, y en ambos casos debe ser una escuela configurada.
 */
export function resolveSchool(inputSchool: string | undefined, owner: RegistryOwner): { success: true; school: string } | { success: false; error: string } {
  const code = (inputSchool || owner.school || '').trim();
  const school = getSchoolByCode(code);
  if (!school) return { success: false, error: 'Seleccione una escuela válida para registrar el producto.' };
  return { success: true, school: school.code };
}

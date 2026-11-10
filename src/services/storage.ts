import { AcademicDegree, OfficialResearchLine, ScientificProduct, TeacherUser, UserNotification } from '../types';
import { INITIAL_PRODUCTS, INITIAL_TEACHERS, INITIAL_NOTIFICATIONS, LEGACY_ECMC_PRODUCT_IDS, LEGACY_ECMC_TEACHER_IDS } from '../constants/seedData';
import { INITIAL_SCHOOL_PRODUCTS, INITIAL_SCHOOL_TEACHERS } from '../constants/schoolSeedData';
import { ALL_OFFICIAL_RESEARCH_LINES } from '../constants/researchLines';


const INITIAL_TEACHER_DATA = [...INITIAL_TEACHERS, ...INITIAL_SCHOOL_TEACHERS];
const INITIAL_PRODUCT_DATA = [...INITIAL_PRODUCTS, ...INITIAL_SCHOOL_PRODUCTS];
const SEED_TEACHER_BY_ID = new Map(INITIAL_TEACHER_DATA.map((teacher) => [teacher.id, teacher]));

function completeSyntheticTeacher(teacher: TeacherUser): TeacherUser {
  if (teacher.id.startsWith('ecmc-orcid-researcher-')) return teacher;
  const defaults = SEED_TEACHER_BY_ID.get(teacher.id);
  if (!defaults || teacher.syntheticProfileSeedVersion) return teacher;

  let updated = teacher;
  const fillIfMissing = <K extends keyof TeacherUser>(key: K) => {
    if ((updated[key] === undefined || updated[key] === null) && defaults[key] !== undefined) {
      updated = { ...updated, [key]: defaults[key] };
    }
  };

  [
    'researchLines', 'researchSublines', 'githubUrl', 'googleScholarId', 'googleScholarHIndex',
    'scopusAuthorId', 'scopusHIndex', 'webOfScienceId',
  ].forEach((key) => fillIfMissing(key as keyof TeacherUser));

  const syntheticAcademicProfileFields = (defaults.syntheticAcademicProfileFields || [])
    .filter(field => updated[field] === defaults[field]);
  const syntheticBibliometricFields = (defaults.syntheticBibliometricFields || [])
    .filter(field => updated[field] === defaults[field]);

  return {
    ...updated,
    syntheticAcademicProfileFields,
    syntheticBibliometricFields,
    syntheticProfileSeedVersion: 1,
  };
}

export const STORAGE_KEYS = {
  PRODUCTS: 'red_papers_products_v1',
  TEACHERS: 'red_papers_teachers_v1',
  NOTIFICATIONS: 'red_papers_notifications_v1',
  CURRENT_USER: 'red_papers_current_user_v1',
  PUBLIC_VISIBILITY_CONFIG: 'red_papers_public_config_v1',
  ECMC_ORCID_IMPORT: 'red_papers_ecmc_orcid_import_v1',
  ECMC_LEGACY_BACKUP: 'red_papers_ecmc_pre_orcid_backup_v1',
};

/** Restore the original values if any part of a multi-key save fails. */
export function withStorageRollback(keys: readonly string[], save: () => boolean): boolean {
  let previous: Array<[string, string | null]> = [];
  try {
    previous = keys.map(key => [key, localStorage.getItem(key)]);
    if (save()) return true;
  } catch (err) {
    console.error('Error guardando cambios en almacenamiento local:', err);
  }
  for (const [key, value] of previous.reverse()) {
    try {
      if (localStorage.getItem(key) === value) continue;
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (err) {
      console.error('Error revirtiendo el guardado local:', err);
    }
  }
  return false;
}

const ECMC_IMPORT_VERSION = 'emcc-orcid-2026-10-13-lines-v2';
interface ImportedStorage {
  products: ScientificProduct[];
  teachers: TeacherUser[];
  notifications: UserNotification[];
  currentUser: TeacherUser | null;
}

function readArray<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value : fallback;
  } catch { return fallback; }
}

const isLegacyEcmcTeacher = (teacher: TeacherUser) =>
  (!teacher.school || teacher.school === 'ECMC') && LEGACY_ECMC_TEACHER_IDS.has(teacher.id);
const isLegacyEcmcProduct = (product: ScientificProduct) =>
  (!product.school || product.school === 'ECMC') && LEGACY_ECMC_PRODUCT_IDS.has(product.id);
const importDoi = (doi?: string) => doi?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').toLowerCase();

/** Replace only the retired ECMC fixtures, once, without clearing users' storage. */
function importEcmcStorage(): ImportedStorage | undefined {
  try {
    if (localStorage.getItem(STORAGE_KEYS.ECMC_ORCID_IMPORT) === ECMC_IMPORT_VERSION) return undefined;
    const previousProducts = readArray(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCT_DATA);
    const previousTeachers = readArray(STORAGE_KEYS.TEACHERS, INITIAL_TEACHER_DATA);
    const previousNotifications = readArray(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    let currentUser: TeacherUser | null = null;
    try { currentUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || 'null'); } catch { /* Invalid session. */ }

    const teachers = previousTeachers.filter(teacher => !isLegacyEcmcTeacher(teacher));
    const researcherIds = new Map<string, string>();
    for (const source of INITIAL_TEACHERS) {
      const existing = teachers.find(teacher => teacher.school === 'ECMC'
        && (teacher.id === source.id || (!!source.orcid && teacher.orcid === source.orcid)));
      researcherIds.set(source.id, existing?.id || source.id);
      if (!existing) teachers.push(source);
    }

    const products = previousProducts.filter(product => !isLegacyEcmcProduct(product));
    const existingIds = new Set(products.map(product => product.id));
    const existingDois = new Set(products.filter(product => product.school === 'ECMC').map(product => importDoi(product.doi)).filter(Boolean));
    for (const source of INITIAL_PRODUCTS) {
      const doi = importDoi(source.doi);
      const existingIndex = products.findIndex(product => product.id === source.id);
      if (existingIndex >= 0) {
        const existing = products[existingIndex];
        const previousClassification = existing.bibliographicSource?.researchLineClassification;
        if (previousClassification && existing.bibliographicSource) {
          // Refresh an older automated suggestion when the dictionary changes.
          const bibliographicSource = { ...existing.bibliographicSource };
          if (source.bibliographicSource?.researchLineClassification) {
            bibliographicSource.researchLineClassification = source.bibliographicSource.researchLineClassification;
          } else {
            delete bibliographicSource.researchLineClassification;
          }
          products[existingIndex] = { ...existing, researchLine: source.researchLine, bibliographicSource };
        // Fill only an empty line on an imported record; preserve manual assignments.
        } else if (!existing.researchLine && source.researchLine && existing.bibliographicSource) {
          products[existingIndex] = {
            ...existing,
            researchLine: source.researchLine,
            bibliographicSource: {
              ...existing.bibliographicSource,
              researchLineClassification: source.bibliographicSource?.researchLineClassification,
            },
          };
        }
        continue;
      }
      if (doi && existingDois.has(doi)) continue;
      products.push({ ...source, authorIds: source.authorIds?.map(id => researcherIds.get(id) || id) });
      existingIds.add(source.id);
      if (doi) existingDois.add(doi);
    }
    const notifications = previousNotifications.filter(notification => !LEGACY_ECMC_PRODUCT_IDS.has(notification.productId));
    const previousSession = currentUser;
    if (currentUser && isLegacyEcmcTeacher(currentUser)) {
      // Keep the public testing account separate from every real researcher.
      currentUser = currentUser.id === 'doc-001' ? {
        id: 'doc-001', name: 'Profesor de prueba', email: 'profesor@yachaytech.edu.ec',
        rank: 'Profesor', school: 'ECMC', role: 'teacher', createdAt: currentUser.createdAt,
      } : null;
    }

    const snapshot = { products, teachers, notifications, currentUser };
    const keys = [STORAGE_KEYS.PRODUCTS, STORAGE_KEYS.TEACHERS, STORAGE_KEYS.NOTIFICATIONS,
      STORAGE_KEYS.CURRENT_USER, STORAGE_KEYS.ECMC_ORCID_IMPORT, STORAGE_KEYS.ECMC_LEGACY_BACKUP];
    withStorageRollback(keys, () => {
      const removedProducts = previousProducts.filter(isLegacyEcmcProduct);
      const removedTeachers = previousTeachers.filter(isLegacyEcmcTeacher);
      const removedNotifications = previousNotifications.filter(notification => LEGACY_ECMC_PRODUCT_IDS.has(notification.productId));
      if ((removedProducts.length || removedTeachers.length || removedNotifications.length)
        && !localStorage.getItem(STORAGE_KEYS.ECMC_LEGACY_BACKUP)) {
        localStorage.setItem(STORAGE_KEYS.ECMC_LEGACY_BACKUP, JSON.stringify({
          migratedAt: new Date().toISOString(), products: removedProducts, teachers: removedTeachers,
          notifications: removedNotifications, currentUser: previousSession,
        }));
      }
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachers));
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
      if (currentUser) localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
      else localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.setItem(STORAGE_KEYS.ECMC_ORCID_IMPORT, ECMC_IMPORT_VERSION);
      return true;
    });
    // Even if persistence is unavailable, render the factual dataset and retry later.
    return snapshot;
  } catch { return undefined; }
}

// Configuración de visibilidad pública
// Por defecto: Solo productos 'verificados' para visitantes; el propietario ve todos los suyos.
export interface PublicVisibilityConfig {
  showOnlyVerifiedForVisitors: boolean;
}

const DEFAULT_CONFIG: PublicVisibilityConfig = {
  showOnlyVerifiedForVisitors: true,
};

function academicDegreeFrom(value?: string): AcademicDegree | undefined {
  if (!value) return undefined;
  if (/\b(?:ph\.?\s*d|doctorad[oa]?|doctora?)\b/i.test(value)) return 'PhD';
  if (/\b(?:m\.?\s*sc|master|maestr[ií]a|mag[ií]ster)\b/i.test(value)) return 'MSc';
  if (/\b(?:b\.?\s*sc|ingenier[oa]|licenciatur[ao])\b/i.test(value)) return 'BSc';
  return undefined;
}

function academicFieldFrom(value?: string): string | undefined {
  const match = value?.match(/\b(?:en|de)\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function normalizeTeacher(teacher: TeacherUser): TeacherUser {
  if (teacher.id.startsWith('ecmc-orcid-researcher-')) return teacher;
  const name = teacher.name || '';
  const namePrefix = name.match(/^\s*((?:m\.?\s*sc|ph\.?\s*d|dr|dra|ing|mag)\.?)\s+/i)?.[1];
  const cleanName = name.replace(/^\s*(?:(?:m\.?\s*sc|ph\.?\s*d|dr|dra|ing|mag)\.?)\s+/i, '').trim();
  const rankParts = (teacher.rank || 'Profesor').split(/\s*\/\s*/);
  const credentialIndex = rankParts.findIndex(part => academicDegreeFrom(part));
  const credential = credentialIndex >= 0 ? rankParts[credentialIndex] : undefined;
  const academicDegree = teacher.academicDegree || academicDegreeFrom(credential) || academicDegreeFrom(namePrefix);
  const academicField = teacher.academicField || academicFieldFrom(credential);
  const savedResearchLines = Array.isArray(teacher.researchLines) ? teacher.researchLines : teacher.researchLine ? [teacher.researchLine] : [];
  const researchLines = [...new Set(savedResearchLines)].filter((line): line is OfficialResearchLine => ALL_OFFICIAL_RESEARCH_LINES.includes(line));
  const rank = credential
    ? rankParts.filter((_, index) => index !== credentialIndex).join(' / ').trim() || 'Profesor'
    : teacher.rank || 'Profesor';

  return { ...teacher, name: cleanName, rank, academicDegree, academicField, researchLines: researchLines.length ? researchLines : undefined, researchLine: researchLines[0] };
}

export const storageService = {
  getProducts(): ScientificProduct[] {
    try {
      const imported = importEcmcStorage();
      if (imported) return imported.products;
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (!data) {
        this.saveProducts(INITIAL_PRODUCT_DATA);
        return INITIAL_PRODUCT_DATA;
      }
      const storedProducts: ScientificProduct[] = JSON.parse(data);
      const existingIds = new Set(storedProducts.map(product => product.id));
      const newSchoolFixtures = INITIAL_SCHOOL_PRODUCTS.filter(product => !existingIds.has(product.id));
      const products = [...storedProducts, ...newSchoolFixtures];
      if (JSON.stringify(products) !== JSON.stringify(storedProducts)) this.saveProducts(products);
      return products;
    } catch {
      return INITIAL_PRODUCT_DATA;
    }
  },

  saveProducts(products: ScientificProduct[]): boolean {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      return true;
    } catch (err) {
      console.error('Error guardando productos en almacenamiento local:', err);
      return false;
    }
  },

  getTeachers(): TeacherUser[] {
    try {
      const imported = importEcmcStorage();
      if (imported) return imported.teachers.map(teacher => normalizeTeacher(completeSyntheticTeacher(teacher)));
      const data = localStorage.getItem(STORAGE_KEYS.TEACHERS);
      if (!data) {
        const teachers = INITIAL_TEACHER_DATA.map(teacher => normalizeTeacher(completeSyntheticTeacher(teacher)));
        this.saveTeachers(teachers);
        return teachers;
      }
      const storedTeachers: TeacherUser[] = JSON.parse(data);
      const existingIds = new Set(storedTeachers.map(teacher => teacher.id));
      const newSchoolTeachers = INITIAL_SCHOOL_TEACHERS.filter(teacher => !existingIds.has(teacher.id));
      const teachers = [...storedTeachers, ...newSchoolTeachers].map(teacher => normalizeTeacher(completeSyntheticTeacher(teacher)));
      if (JSON.stringify(teachers) !== JSON.stringify(storedTeachers)) this.saveTeachers(teachers);
      return teachers;
    } catch {
      return INITIAL_TEACHER_DATA.map(teacher => normalizeTeacher(completeSyntheticTeacher(teacher)));
    }
  },

  saveTeachers(teachers: TeacherUser[]): boolean {
    try {
      localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachers));
      return true;
    } catch (err) {
      console.error('Error guardando docentes:', err);
      return false;
    }
  },

  getNotifications(): UserNotification[] {
    try {
      const imported = importEcmcStorage();
      if (imported) return imported.notifications;
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (!data) {
        this.saveNotifications(INITIAL_NOTIFICATIONS);
        return INITIAL_NOTIFICATIONS;
      }
      const notifications: UserNotification[] = JSON.parse(data);
      return notifications;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  },

  saveNotifications(notifs: UserNotification[]): boolean {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
      return true;
    } catch (err) {
      console.error('Error guardando notificaciones:', err);
      return false;
    }
  },

  getCurrentUser(): TeacherUser | null {
    try {
      const imported = importEcmcStorage();
      if (imported) return imported.currentUser ? normalizeTeacher(completeSyntheticTeacher(imported.currentUser)) : null;
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (!data) return null;
      const storedUser: TeacherUser = JSON.parse(data);
      const user = normalizeTeacher(completeSyntheticTeacher(storedUser));
      if (JSON.stringify(user) !== JSON.stringify(storedUser)) this.setCurrentUser(user);
      return user;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: TeacherUser | null): boolean {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
      return true;
    } catch (err) {
      console.error('Error guardando usuario actual:', err);
      return false;
    }
  },

  getPublicConfig(): PublicVisibilityConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PUBLIC_VISIBILITY_CONFIG);
      return data ? JSON.parse(data) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  },

  savePublicConfig(config: PublicVisibilityConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PUBLIC_VISIBILITY_CONFIG, JSON.stringify(config));
    } catch (err) {
      console.error('Error guardando configuración pública:', err);
    }
  },

  resetToSeed(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCT_DATA));
      localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(INITIAL_TEACHER_DATA.map(teacher => normalizeTeacher(completeSyntheticTeacher(teacher)))));
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
      localStorage.setItem(STORAGE_KEYS.PUBLIC_VISIBILITY_CONFIG, JSON.stringify(DEFAULT_CONFIG));
      localStorage.setItem(STORAGE_KEYS.ECMC_ORCID_IMPORT, ECMC_IMPORT_VERSION);
    } catch (err) {
      console.error('Error restableciendo datos:', err);
    }
  },
};

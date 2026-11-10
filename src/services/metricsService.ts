import { ScientificProduct, TeacherUser, TeacherMetrics, SchoolMetrics, AcademicSemester } from '../types';
import { ACADEMIC_SEMESTERS } from '../constants/researchLines';
import { storageService } from './storage';
import { productCitationValue, productMatchesTeacher } from './productPresentation';

export interface TemporalDataPoint {
  semester: string;
  unit?: 'year' | 'semester';
  publications: number;
  projects: number;
  total: number;
}

const academicSemesterSet = new Set<AcademicSemester>(ACADEMIC_SEMESTERS);

function semesterForProduct(product: ScientificProduct): AcademicSemester | undefined {
  if (product.semester && academicSemesterSet.has(product.semester)) return product.semester;

  // Los registros recientes guardan una fecha precisa en vez del semestre antiguo.
  const productDate = product.type === 'publicacion'
    ? product.publicationDate
    : product.projectStartDate;
  const dateParts = productDate?.match(/^(\d{4})-(\d{2})/);
  if (!dateParts) return undefined;

  const year = Number(dateParts[1]);
  const month = Number(dateParts[2]);
  if (month < 1 || month > 12) return undefined;

  const semester = `${year}-${month <= 6 ? 1 : 2}` as AcademicSemester;
  return academicSemesterSet.has(semester) ? semester : undefined;
}

export const metricsService = {
  /**
   * Calcula las métricas institucionales de la Escuela de Ciencias Matemáticas y Computacionales (ECMC)
   * Los productos en coautoría cuentan UNA sola vez para el total institucional.
   */
  calculateSchoolMetrics(products: ScientificProduct[]): SchoolMetrics {
    // Para indicadores institucionales oficiales, tomamos los productos verificados
    // (siguiendo la política de visualización y trazabilidad)
    const verifiedProducts = products.filter((p) => p.status === 'verificado');
    const publications = verifiedProducts.filter((p) => p.type === 'publicacion');
    const projects = verifiedProducts.filter((p) => p.type === 'proyecto');

    const totalCitations = publications.reduce((acc, p) => acc + (productCitationValue(p) ?? 0), 0);

    return {
      totalPublications: publications.length,
      totalProjects: projects.length,
      totalCitations,
      researchLinesWithProduction: new Set(verifiedProducts.map((product) => product.researchLine).filter(Boolean)).size,
    };
  },

  /**
   * Calcula las métricas individuales para cada docente
   */
  calculateTeacherMetrics(teacher: TeacherUser, allProducts: ScientificProduct[]): TeacherMetrics {
    // Las métricas de perfiles públicos se calculan solo con productos verificados.
    const verifiedProducts = allProducts.filter((p) => p.status === 'verificado');
    const teacherProducts = verifiedProducts.filter(product => productMatchesTeacher(product, teacher));

    const publications = teacherProducts.filter((p) => p.type === 'publicacion');
    const projects = teacherProducts.filter((p) => p.type === 'proyecto');

    // Citas acumuladas en publicaciones
    const citationsTotal = publications.reduce((acc, p) => acc + (productCitationValue(p) ?? 0), 0);
    return {
      teacher,
      publicationsCount: publications.length,
      projectsCount: projects.length,
      citationsTotal,
    };
  },

  /**
   * Obtiene la tabla completa de métricas para todos los docentes registrados
   */
  getAllTeacherMetrics(): TeacherMetrics[] {
    const teachers = storageService.getTeachers();
    const products = storageService.getProducts();

    return teachers.map((teacher) => this.calculateTeacherMetrics(teacher, products));
  },

  /**
   * Genera los puntos de la serie temporal por semestre (2021-1 a 2026-2)
   * Los semestres sin producción registran explícitamente 0
   */
  getTemporalEvolutionData(products: ScientificProduct[]): TemporalDataPoint[] {
    if (products.some(product => product.school === 'ECMC' && product.bibliographicSource)) {
      const verified = products.filter(product => product.status === 'verificado');
      const years = verified.map(product => product.year).filter(year => Number.isInteger(year) && year > 0);
      if (!years.length) return [];
      // The imported source records a year, not a semester or publication day.
      // An annual series keeps every record without inventing either value.
      const firstYear = Math.min(...years);
      const lastYear = Math.max(...years);
      return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
        const year = firstYear + index;
        const yearProducts = verified.filter(product => product.year === year);
        const publications = yearProducts.filter(product => product.type === 'publicacion').length;
        const projects = yearProducts.filter(product => product.type === 'proyecto').length;
        return { semester: String(year), unit: 'year' as const, publications, projects, total: publications + projects };
      });
    }
    const counts = new Map<AcademicSemester, { publications: number; projects: number }>(
      ACADEMIC_SEMESTERS.map((semester) => [semester, { publications: 0, projects: 0 }])
    );

    products.forEach((product) => {
      if (product.status !== 'verificado') return;
      const semester = semesterForProduct(product);
      if (!semester) return;

      const count = counts.get(semester)!;
      if (product.type === 'publicacion') count.publications += 1;
      else if (product.type === 'proyecto') count.projects += 1;
    });

    return ACADEMIC_SEMESTERS.map((semester) => {
      const { publications: pubCount, projects: projCount } = counts.get(semester)!;

      return {
        semester,
        publications: pubCount,
        projects: projCount,
        total: pubCount + projCount,
      };
    });
  },
};

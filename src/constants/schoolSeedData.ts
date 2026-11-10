import type { OfficialResearchLine, SchoolCode, ScientificProduct, TeacherUser } from '../types';
import { SCHOOLS } from './schools';

type AdditionalSchoolCode = Exclude<SchoolCode, 'ECMC'>;

interface TeacherSeed {
  name: string;
  rank: string;
  academicDegree: 'PhD' | 'MSc';
  academicField: string;
  yachayEntryYear: number;
  githubSlug: string;
  scholarId: string;
  scopusId: string;
  webOfScienceId: string;
  scholarHIndex: number;
  scopusHIndex: number;
  bio: string;
}

const TEACHERS_BY_SCHOOL: Record<AdditionalSchoolCode, [TeacherSeed, TeacherSeed]> = {
  ECIAA: [
    { name: 'Camila Vinueza Cevallos', rank: 'Profesora agregada', academicDegree: 'PhD', academicField: 'Agroecología', yachayEntryYear: 2019, githubSlug: 'camila-vinueza-yachay', scholarId: 'VnZcAg19', scopusId: '58310420190', webOfScienceId: 'JQF-2194-2019', scholarHIndex: 11, scopusHIndex: 8, bio: 'Investiga sistemas agrícolas sostenibles, suelos volcánicos y adaptación de cultivos andinos.' },
    { name: 'Mauricio Cárdenas Ulloa', rank: 'Profesor auxiliar', academicDegree: 'MSc', academicField: 'Ingeniería Agroindustrial', yachayEntryYear: 2022, githubSlug: 'mauricio-cardenas-agro', scholarId: 'McUllAg22', scopusId: '58310420221', webOfScienceId: 'KLM-7402-2022', scholarHIndex: 7, scopusHIndex: 5, bio: 'Trabaja en innovación agroindustrial, aprovechamiento de biomasa y desarrollo de cadenas de valor locales.' },
  ],
  ECBI: [
    { name: 'Daniela Espinosa Rivas', rank: 'Profesora principal', academicDegree: 'PhD', academicField: 'Biología de la Conservación', yachayEntryYear: 2018, githubSlug: 'daniela-espinosa-bio', scholarId: 'DEspBio18', scopusId: '58310420181', webOfScienceId: 'MNP-6148-2018', scholarHIndex: 16, scopusHIndex: 13, bio: 'Estudia biodiversidad andina, conservación de ecosistemas y respuestas ecológicas al cambio ambiental.' },
    { name: 'Felipe Narváez Molina', rank: 'Profesor agregado', academicDegree: 'PhD', academicField: 'Bioingeniería', yachayEntryYear: 2021, githubSlug: 'felipe-narvaez-bioeng', scholarId: 'FNarBio21', scopusId: '58310420212', webOfScienceId: 'RQS-3162-2021', scholarHIndex: 10, scopusHIndex: 8, bio: 'Su trabajo integra microbiología, biología molecular y herramientas de ingeniería para aplicaciones biomédicas.' },
  ],
  ECFN: [
    { name: 'Lucía Andrade Villamar', rank: 'Profesora principal', academicDegree: 'PhD', academicField: 'Física de Materiales', yachayEntryYear: 2017, githubSlug: 'lucia-andrade-fisica', scholarId: 'LAndFis17', scopusId: '58310420172', webOfScienceId: 'TUV-9073-2017', scholarHIndex: 19, scopusHIndex: 15, bio: 'Investiga materiales funcionales y nanoestructurados mediante técnicas experimentales y modelos multiescala.' },
    { name: 'Esteban Rueda Ponce', rank: 'Profesor auxiliar', academicDegree: 'MSc', academicField: 'Nanotecnología', yachayEntryYear: 2023, githubSlug: 'esteban-rueda-nano', scholarId: 'ERuedaNano23', scopusId: '58310420232', webOfScienceId: 'VWX-4421-2023', scholarHIndex: 8, scopusHIndex: 6, bio: 'Desarrolla instrumentación científica accesible y estudia fenómenos físicos en sistemas complejos.' },
  ],
  ECTEA: [
    { name: 'Natalia Villacrés Peralta', rank: 'Profesora agregada', academicDegree: 'PhD', academicField: 'Geociencias', yachayEntryYear: 2019, githubSlug: 'natalia-villacres-geociencias', scholarId: 'NVGeo19', scopusId: '58310420193', webOfScienceId: 'YZA-1285-2019', scholarHIndex: 13, scopusHIndex: 10, bio: 'Analiza procesos geológicos, amenazas naturales y evolución del paisaje en la región andina.' },
    { name: 'Diego Cedeño Mora', rank: 'Profesor auxiliar', academicDegree: 'MSc', academicField: 'Gestión Ambiental', yachayEntryYear: 2022, githubSlug: 'diego-cedeno-ambiente', scholarId: 'DCMedAmb22', scopusId: '58310420224', webOfScienceId: 'BCD-6830-2022', scholarHIndex: 8, scopusHIndex: 6, bio: 'Investiga clima, teledetección y soluciones territoriales para la gestión ambiental sostenible.' },
  ],
  ECQI: [
    { name: 'Paula Almeida Cárdenas', rank: 'Profesora principal', academicDegree: 'PhD', academicField: 'Química de Materiales', yachayEntryYear: 2018, githubSlug: 'paula-almeida-quimica', scholarId: 'PAlmQ18', scopusId: '58310420185', webOfScienceId: 'EFG-5381-2018', scholarHIndex: 17, scopusHIndex: 14, bio: 'Diseña materiales funcionales y catalizadores para procesos químicos más eficientes y sostenibles.' },
    { name: 'Ricardo Ponce Jaramillo', rank: 'Profesor agregado', academicDegree: 'PhD', academicField: 'Ingeniería Química', yachayEntryYear: 2020, githubSlug: 'ricardo-ponce-ingenieria-quimica', scholarId: 'RPonQI20', scopusId: '58310420205', webOfScienceId: 'HIJ-2946-2020', scholarHIndex: 12, scopusHIndex: 9, bio: 'Combina química computacional y modelado molecular para estudiar sistemas energéticos y farmacológicos.' },
  ],
  YTLC: [
    { name: 'Gabriela Molina Salcedo', rank: 'Profesora agregada', academicDegree: 'PhD', academicField: 'Lingüística Aplicada', yachayEntryYear: 2017, githubSlug: 'gabriela-molina-language', scholarId: 'GMolLang17', scopusId: '58310420176', webOfScienceId: 'KLM-3904-2017', scholarHIndex: 12, scopusHIndex: 9, bio: 'Investiga evaluación de idiomas, prácticas multilingües y enseñanza del inglés en educación superior.' },
    { name: 'Thomas Reed Cárdenas', rank: 'Profesor auxiliar', academicDegree: 'MSc', academicField: 'Educación y Tecnología', yachayEntryYear: 2022, githubSlug: 'thomas-reed-education', scholarId: 'TReedEd22', scopusId: '58310420227', webOfScienceId: 'NOP-6518-2022', scholarHIndex: 7, scopusHIndex: 5, bio: 'Diseña recursos de aprendizaje de idiomas apoyados por tecnología y estudia la enseñanza en inglés.' },
  ],
};

const SUBLINES_BY_RESEARCH_LINE: Partial<Record<OfficialResearchLine, string[]>> = {
  'Ciencias Agrícolas': ['Agroecología y sistemas de cultivo andinos', 'Manejo de suelos y agricultura de precisión'],
  'Investigación del mercado de productos agroindustriales': ['Cadenas de valor agroalimentarias', 'Consumo y comercialización de productos locales'],
  'Ciencias Animales': ['Bienestar y nutrición animal', 'Sanidad y producción sostenible'],
  'I+D+i Agroindustrial': ['Bioprocesos y valorización de biomasa', 'Innovación y desarrollo de alimentos'],
  'Ecología, evolución y conservación de ecosistemas terrestres': ['Ecología de comunidades andinas', 'Conservación y conectividad de hábitats'],
  Microbiología: ['Microbiología ambiental', 'Genómica y diversidad microbiana'],
  'Biología de Sistemas Acuáticos': ['Ecología de agua dulce', 'Biodiversidad y calidad de ecosistemas acuáticos'],
  'Biología celular, biología molecular y genética': ['Genética de poblaciones', 'Biología molecular de especies nativas'],
  Biomedicina: ['Biomarcadores y diagnóstico molecular', 'Biología celular aplicada a la salud'],
  Biomateriales: ['Materiales biocompatibles', 'Polímeros de origen biológico'],
  'Materiales nanoestructurados, síntesis y caracterización': ['Nanomateriales funcionales', 'Técnicas de caracterización avanzada'],
  'Ciencia de materiales teórica': ['Modelado atomístico de materiales', 'Propiedades electrónicas y térmicas'],
  'Física de sistemas complejos e interdisciplinarios': ['Sistemas fuera del equilibrio', 'Redes complejas y fenómenos emergentes'],
  'Astrofísica, Cosmología y Física Teórica': ['Estructura y evolución del universo', 'Modelos de gravitación y cosmología'],
  'Desarrollo Instrumentación científica de bajo costo': ['Sensores para laboratorios docentes', 'Instrumentación abierta y adquisición de datos'],
  'Acústica y Aplicaciones': ['Acústica ambiental', 'Procesamiento y control de señales sonoras'],
  'Geología física y aplicada': ['Cartografía geológica', 'Procesos tectónicos y geomorfología'],
  'Medioambiente y clima': ['Variabilidad climática andina', 'Monitoreo ambiental y teledetección'],
  'Riesgos y amenazas naturales': ['Evaluación de susceptibilidad', 'Gestión territorial del riesgo'],
  'Patrimonio geológico, geoeducación y sostenibilidad': ['Geoconservación y geoparques', 'Educación para la sostenibilidad territorial'],
  'Geomática aplicada a las geociencias': ['Sistemas de información geográfica', 'Observación de la Tierra y análisis espacial'],
  'Materiales funcionales': ['Superficies catalíticas', 'Materiales para conversión y almacenamiento de energía'],
  'Química medicinal y farmacología molecular': ['Diseño de moléculas bioactivas', 'Interacciones fármaco-receptor'],
  'Desarrollo sostenible: Energía, alimentos, agricultura y medio ambiente': ['Química verde y energía', 'Procesos sostenibles para alimentos y agricultura'],
  'Química teórica y computacional': ['Simulación molecular', 'Modelado de reacciones químicas'],
  'Education technology & AI': ['AI-assisted language learning', 'Digital learning resources'],
  'English-Medium Instruction': ['Academic language in EMI', 'Teaching disciplinary content in English'],
  'English for specific purposes': ['English for science and engineering', 'Discipline-specific academic writing'],
  'Pedagogy, teacher and teacher education': ['Teacher professional development', 'Reflective and active learning'],
  'Sociolinguistics/Language and Culture': ['Language practices in multilingual communities', 'Language, identity and culture'],
  'Language Assessment': ['Placement and proficiency assessment', 'Assessment literacy and feedback'],
};

const PUBLICATION_DETAILS: Partial<Record<OfficialResearchLine, { title: string; abstract: string }>> = {
  'Ciencias Agrícolas': { title: 'Manejo sostenible de suelos volcánicos para cultivos andinos', abstract: 'Compara prácticas de manejo de suelo y su relación con la productividad y resiliencia de cultivos de altura.' },
  'Investigación del mercado de productos agroindustriales': { title: 'Valor agregado y preferencias de mercado para productos agroindustriales locales', abstract: 'Analiza oportunidades de comercialización y transformación para cadenas agroindustriales de la región.' },
  'Ciencias Animales': { title: 'Bienestar animal y eficiencia productiva en sistemas altoandinos', abstract: 'Evalúa indicadores de bienestar y manejo en sistemas pecuarios de altura con enfoque de sostenibilidad.' },
  'I+D+i Agroindustrial': { title: 'Aprovechamiento de residuos agrícolas para nuevos productos agroindustriales', abstract: 'Estudia rutas de valorización de biomasa residual para desarrollar productos de mayor valor agregado.' },
  'Ecología, evolución y conservación de ecosistemas terrestres': { title: 'Conectividad ecológica de bosques montanos frente a cambios de cobertura', abstract: 'Combina observaciones de campo y análisis espacial para identificar áreas prioritarias de conservación.' },
  Microbiología: { title: 'Diversidad microbiana de suelos volcánicos bajo distintos usos del territorio', abstract: 'Caracteriza comunidades microbianas y sus asociaciones con propiedades del suelo en paisajes andinos.' },
  'Biología de Sistemas Acuáticos': { title: 'Indicadores biológicos para el monitoreo de ecosistemas acuáticos de altura', abstract: 'Propone indicadores de biodiversidad para evaluar cambios ambientales en ríos y lagunas altoandinas.' },
  'Biología celular, biología molecular y genética': { title: 'Variación genética y adaptación de especies nativas de los Andes', abstract: 'Examina patrones de diversidad genética asociados con gradientes ambientales y adaptación local.' },
  Biomedicina: { title: 'Biomarcadores moleculares para apoyar la detección temprana de enfermedades', abstract: 'Explora perfiles moleculares y estrategias de análisis para fortalecer estudios biomédicos regionales.' },
  Biomateriales: { title: 'Biomateriales biodegradables para la liberación controlada de compuestos', abstract: 'Caracteriza matrices biocompatibles y su potencial para aplicaciones en salud y biotecnología.' },
  'Materiales nanoestructurados, síntesis y caracterización': { title: 'Síntesis y caracterización de nanomateriales para aplicaciones energéticas', abstract: 'Relaciona métodos de síntesis con propiedades ópticas, estructurales y funcionales de nuevos materiales.' },
  'Ciencia de materiales teórica': { title: 'Modelado multiescala de propiedades electrónicas en materiales funcionales', abstract: 'Emplea simulación computacional para estudiar la estructura y respuesta de materiales de interés tecnológico.' },
  'Física de sistemas complejos e interdisciplinarios': { title: 'Dinámica de redes complejas en sistemas físicos y biológicos', abstract: 'Analiza patrones de interacción y comportamiento colectivo mediante modelos de sistemas complejos.' },
  'Astrofísica, Cosmología y Física Teórica': { title: 'Evolución de estructuras cósmicas en modelos cosmológicos de referencia', abstract: 'Compara escenarios teóricos para comprender la formación de estructuras a gran escala en el universo.' },
  'Desarrollo Instrumentación científica de bajo costo': { title: 'Instrumentación accesible para mediciones físicas en laboratorios universitarios', abstract: 'Presenta el diseño y la evaluación de sensores modulares para prácticas y observaciones experimentales.' },
  'Acústica y Aplicaciones': { title: 'Propagación del sonido y estrategias de control acústico en espacios educativos', abstract: 'Caracteriza condiciones acústicas y evalúa alternativas de acondicionamiento para ambientes de aprendizaje.' },
  'Geología física y aplicada': { title: 'Cartografía geológica de unidades volcánicas en el corredor interandino', abstract: 'Integra trabajo de campo y cartografía para describir unidades y estructuras geológicas de la región.' },
  'Medioambiente y clima': { title: 'Variabilidad climática y disponibilidad hídrica en cuencas de montaña', abstract: 'Examina registros ambientales y variables territoriales para comprender cambios en cuencas andinas.' },
  'Riesgos y amenazas naturales': { title: 'Evaluación de susceptibilidad a movimientos en masa en zonas de alta montaña', abstract: 'Combina información topográfica, geológica y climática para apoyar la planificación territorial preventiva.' },
  'Patrimonio geológico, geoeducación y sostenibilidad': { title: 'Geopatrimonio y geoeducación para la sostenibilidad de comunidades locales', abstract: 'Identifica elementos de interés geológico y propone recursos educativos vinculados al territorio.' },
  'Geomática aplicada a las geociencias': { title: 'Análisis geoespacial de cambios territoriales mediante observación satelital', abstract: 'Aplica herramientas geomáticas para monitorear transformaciones del paisaje y sus implicaciones ambientales.' },
  'Materiales funcionales': { title: 'Superficies funcionales para procesos catalíticos de menor impacto ambiental', abstract: 'Estudia la relación entre composición, estructura superficial y desempeño catalítico de materiales.' },
  'Química medicinal y farmacología molecular': { title: 'Evaluación computacional de moléculas bioactivas para estudios farmacológicos', abstract: 'Integra modelado molecular y análisis de interacciones para priorizar compuestos de interés biomédico.' },
  'Desarrollo sostenible: Energía, alimentos, agricultura y medio ambiente': { title: 'Rutas químicas sostenibles para energía, alimentos y producción agrícola', abstract: 'Compara procesos de menor impacto ambiental aplicables a sectores productivos estratégicos.' },
  'Química teórica y computacional': { title: 'Simulación molecular de mecanismos de reacción en sistemas químicos complejos', abstract: 'Emplea métodos computacionales para describir mecanismos de reacción y propiedades de moléculas.' },
  'Education technology & AI': { title: 'AI-supported feedback for academic English writing in STEM courses', abstract: 'Explores feedback strategies that combine language instruction and responsible AI support for university writers.' },
  'English-Medium Instruction': { title: 'Academic language practices in English-Medium university classrooms', abstract: 'Examines how instructors and students negotiate disciplinary content and language in English-taught courses.' },
  'English for specific purposes': { title: 'English for science and engineering: needs analysis and learning resources', abstract: 'Identifies communication needs in STEM fields and develops resources for discipline-specific language learning.' },
  'Pedagogy, teacher and teacher education': { title: 'Reflective teaching practices for multilingual higher education', abstract: 'Studies professional learning strategies that support active teaching and inclusive language education.' },
  'Sociolinguistics/Language and Culture': { title: 'Language, identity and culture in multilingual university communities', abstract: 'Documents language practices and perceptions of identity among members of a multilingual academic community.' },
  'Language Assessment': { title: 'Evidence-based placement and feedback for university language assessment', abstract: 'Evaluates assessment tasks and feedback practices to support transparent language learning pathways.' },
};

const PROJECT_DETAILS: Record<AdditionalSchoolCode, [{ title: string; abstract: string }, { title: string; abstract: string }]> = {
  ECIAA: [
    { title: 'Sistemas agroalimentarios resilientes para comunidades andinas', abstract: 'Proyecto interdisciplinario sobre prácticas agrícolas sostenibles, calidad de suelo y cadenas de producción local.' },
    { title: 'Innovación y aprovechamiento de biomasa agroindustrial', abstract: 'Desarrollo de alternativas para agregar valor a subproductos agrícolas y fortalecer procesos productivos.' },
  ],
  ECBI: [
    { title: 'Observatorio de biodiversidad y ecosistemas andinos', abstract: 'Integración de información ecológica para el seguimiento de hábitats, especies y cambios ambientales.' },
    { title: 'Plataforma de caracterización microbiológica y biomédica', abstract: 'Generación de capacidades y protocolos para estudios de microbiología, genética y biomedicina.' },
  ],
  ECFN: [
    { title: 'Laboratorio abierto de materiales y nanotecnología', abstract: 'Síntesis, caracterización e intercambio de herramientas experimentales para materiales avanzados.' },
    { title: 'Instrumentación científica para sistemas físicos complejos', abstract: 'Diseño de sensores y recursos de medición para experimentos interdisciplinarios de bajo costo.' },
  ],
  ECTEA: [
    { title: 'Atlas de amenazas y cambios ambientales de la región andina', abstract: 'Herramientas geoespaciales para apoyar el monitoreo climático, geológico y territorial.' },
    { title: 'Geopatrimonio, educación y gestión sostenible del territorio', abstract: 'Trabajo con información geológica y ambiental para fortalecer recursos educativos y planificación local.' },
  ],
  ECQI: [
    { title: 'Materiales funcionales para energía y procesos sostenibles', abstract: 'Investigación de materiales y rutas químicas con potencial para aplicaciones energéticas y ambientales.' },
    { title: 'Modelado molecular para química medicinal y nuevos compuestos', abstract: 'Estudio integrado de moléculas, mecanismos químicos e interacciones de interés farmacológico.' },
  ],
  YTLC: [
    { title: 'Recursos digitales para el aprendizaje de idiomas en STEM', abstract: 'Creación y evaluación de actividades para el desarrollo de comunicación académica en inglés.' },
    { title: 'Enseñanza multilingüe, evaluación y formación docente', abstract: 'Estudio de prácticas pedagógicas, instrumentos de evaluación y desarrollo profesional docente.' },
  ],
};

const SCHOOL_VENUES: Record<AdditionalSchoolCode, string> = {
  ECIAA: 'Revista Andina de Sistemas Agroalimentarios',
  ECBI: 'Revista de Biodiversidad y Ciencias Biológicas',
  ECFN: 'Journal of Applied Physics and Materials',
  ECTEA: 'Revista de Geociencias y Ambiente Andino',
  ECQI: 'Journal of Chemistry and Sustainable Engineering',
  YTLC: 'Journal of Language Education and Technology',
};

const schoolConfigs = SCHOOLS.filter((school) => school.code !== 'ECMC');

export const INITIAL_SCHOOL_TEACHERS: TeacherUser[] = schoolConfigs.flatMap((school) => {
  const schoolCode = school.code as AdditionalSchoolCode;
  return TEACHERS_BY_SCHOOL[schoolCode].map((seed, teacherIndex) => {
    const researchLines = school.researchLines.filter((_, lineIndex) => lineIndex % 2 === teacherIndex) as OfficialResearchLine[];
    const researchSublines = Object.fromEntries(researchLines.map((line) => [line, SUBLINES_BY_RESEARCH_LINE[line] || []]));
    const teacherNumber = String(teacherIndex + 1).padStart(2, '0');
    return {
      id: `seed-${schoolCode.toLowerCase()}-teacher-${teacherNumber}`,
      name: seed.name,
      email: `investigador.${schoolCode.toLowerCase()}.${teacherNumber}@yachaytech.edu.ec`,
      rank: seed.rank,
      academicDegree: seed.academicDegree,
      academicField: seed.academicField,
      yachayEntryYear: seed.yachayEntryYear,
      researchLines,
      researchSublines,
      orcid: `0000-0002-${String(4100 + schoolConfigs.indexOf(school) * 20 + teacherIndex).padStart(4, '0')}-${String(1200 + schoolConfigs.indexOf(school) * 10 + teacherIndex).padStart(4, '0')}`,
      githubUrl: `https://github.com/${seed.githubSlug}`,
      googleScholarId: seed.scholarId,
      googleScholarHIndex: seed.scholarHIndex,
      scopusAuthorId: seed.scopusId,
      scopusHIndex: seed.scopusHIndex,
      webOfScienceId: seed.webOfScienceId,
      syntheticAcademicProfileFields: ['orcid', 'githubUrl', 'googleScholarId', 'scopusAuthorId', 'webOfScienceId'],
      syntheticBibliometricFields: ['googleScholarHIndex', 'scopusHIndex'],
      bio: seed.bio,
      school: schoolCode,
      role: 'teacher',
      createdAt: `${seed.yachayEntryYear}-08-01T08:00:00Z`,
    };
  });
});

const teacherById = new Map(INITIAL_SCHOOL_TEACHERS.map((teacher) => [teacher.id, teacher]));
const projectStates = ['en_pausa', 'finalizado', 'cancelado', 'en_pausa', 'finalizado', 'cancelado'] as const;

const schoolPublications: ScientificProduct[] = schoolConfigs.flatMap((school, schoolIndex) => {
  const schoolCode = school.code as AdditionalSchoolCode;
  return school.researchLines.map((researchLine, lineIndex) => {
    const teacherIndex = lineIndex % 2;
    const ownerId = `seed-${schoolCode.toLowerCase()}-teacher-${String(teacherIndex + 1).padStart(2, '0')}`;
    const owner = teacherById.get(ownerId)!;
    const coauthor = teacherById.get(`seed-${schoolCode.toLowerCase()}-teacher-${String(2 - teacherIndex).padStart(2, '0')}`)!;
    const detail = PUBLICATION_DETAILS[researchLine] || {
      title: `Avances de investigación en ${researchLine}`,
      abstract: `Estudio interdisciplinario sobre ${researchLine.toLowerCase()} y sus aplicaciones en contextos regionales.`,
    };
    const year = 2022 + ((schoolIndex + lineIndex) % 5);
    const month = ((schoolIndex * 2 + lineIndex) % 12) + 1;
    const day = ((schoolIndex + lineIndex * 3) % 27) + 1;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      id: `seed-${schoolCode.toLowerCase()}-publication-${String(lineIndex + 1).padStart(2, '0')}`,
      type: 'publicacion',
      title: detail.title,
      authors: [owner.name, coauthor.name],
      ownerId,
      school: schoolCode,
      year,
      publicationDate: date,
      researchLine,
      abstract: detail.abstract,
      status: 'verificado',
      venue: SCHOOL_VENUES[schoolCode],
      volumeIssue: `Vol. ${year - 2020}, núm. ${((lineIndex + schoolIndex) % 3) + 1}`,
      citations: 3 + ((schoolIndex * 5 + lineIndex * 7) % 24),
      createdAt: `${date}T09:00:00Z`,
      updatedAt: `${date}T09:00:00Z`,
      verifiedAt: `${date}T09:00:00Z`,
    };
  });
});

const schoolProjects: ScientificProduct[] = schoolConfigs.flatMap((school, schoolIndex) => {
  const schoolCode = school.code as AdditionalSchoolCode;
  return PROJECT_DETAILS[schoolCode].map((project, projectIndex) => {
    const projectLineIndex = projectIndex === 0 ? 0 : school.researchLines.length - 1;
    const teacherIndex = projectLineIndex % 2;
    const ownerId = `seed-${schoolCode.toLowerCase()}-teacher-${String(teacherIndex + 1).padStart(2, '0')}`;
    const owner = teacherById.get(ownerId)!;
    const collaborator = teacherById.get(`seed-${schoolCode.toLowerCase()}-teacher-${String(2 - teacherIndex).padStart(2, '0')}`)!;
    const researchLine = school.researchLines[projectLineIndex] as OfficialResearchLine;
    const state = projectIndex === 0 ? 'activo' : projectStates[schoolIndex];
    const startYear = projectIndex === 0 ? 2025 : 2023 + (schoolIndex % 3);
    const startDate = `${startYear}-02-01`;
    const endDate = state === 'finalizado' || state === 'cancelado' ? `${startYear + 1}-12-15` : `${startYear + 2}-11-30`;
    const projectNumber = projectIndex + 1;
    const expectedProducts = projectIndex === 0
      ? ['Protocolo de trabajo documentado', 'Base de resultados compartida', 'Informe de avance del proyecto']
      : ['Conjunto de datos organizado', 'Artículo de resultados', 'Material de divulgación académica'];
    const progress = {
      id: `seed-${schoolCode.toLowerCase()}-project-${projectNumber}-progress`,
      periodStart: startDate,
      periodEnd: `${startYear + 1}-01-31`,
      progressPercent: state === 'finalizado' || state === 'cancelado' ? 100 : 48 + schoolIndex * 4,
      summary: 'El equipo completó la planificación, organizó las fuentes de información y avanzó en el análisis de resultados.',
      completedActivities: ['Plan de trabajo acordado', 'Revisión de fuentes y antecedentes', 'Primer ciclo de análisis'],
      achievedProducts: ['Protocolo de investigación', 'Matriz de datos inicial'],
      nextSteps: 'Completar el siguiente ciclo de trabajo y preparar los productos previstos.',
      statusAfterReport: state === 'en_pausa' ? 'en_pausa' as const : 'activo' as const,
      reportedAt: `${startYear + 1}-02-10T12:00:00Z`,
    };
    const isClosed = state === 'finalizado' || state === 'cancelado';
    return {
      id: `seed-${schoolCode.toLowerCase()}-project-${String(projectNumber).padStart(2, '0')}`,
      type: 'proyecto',
      title: project.title,
      authors: [owner.name, collaborator.name],
      ownerId,
      projectDirector: owner.name,
      projectCode: `${schoolCode}-INV-${startYear}-${String(projectNumber).padStart(3, '0')}`,
      school: schoolCode,
      year: startYear,
      projectStartDate: startDate,
      projectEndDate: endDate,
      researchLine,
      abstract: project.abstract,
      status: 'verificado',
      projectStatus: state,
      projectParticipants: [owner.name, collaborator.name],
      projectDurationMonths: isClosed ? 22 : 30,
      expectedProducts,
      projectProgressReports: isClosed ? [] : [progress],
      projectClosureReport: isClosed ? {
        id: `seed-${schoolCode.toLowerCase()}-project-${projectNumber}-closure`,
        closedAt: endDate,
        finalStatus: state as 'finalizado' | 'cancelado',
        summary: state === 'finalizado' ? 'El equipo completó las actividades y entregó los productos principales del proyecto.' : 'El equipo documentó los avances y cerró formalmente el proyecto de acuerdo con su planificación.',
        deliveredProducts: expectedProducts.slice(0, 2),
        pendingItems: [],
        lessonsLearned: 'La coordinación interdisciplinaria permitió organizar las tareas y compartir los resultados con la comunidad académica.',
      } : undefined,
      fundingVenue: 'Fondo institucional de investigación',
      citations: 0,
      createdAt: `${startDate}T09:00:00Z`,
      updatedAt: `${startDate}T09:00:00Z`,
      verifiedAt: `${startDate}T09:00:00Z`,
    };
  });
});

export const INITIAL_SCHOOL_PRODUCTS: ScientificProduct[] = [...schoolPublications, ...schoolProjects];

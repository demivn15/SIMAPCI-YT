import { TeacherUser } from '../types';
import { SCHOOLS, type SchoolConfig } from './schools';

// Default to the current public demo; production builds can explicitly disable it.
export const DEMO_ENABLED = import.meta.env.DEV || (import.meta.env.VITE_ENABLE_DEMO ?? 'true') === 'true';

// Public test fixtures for this local prototype, not production credentials.
interface DemoAccount {
  user: TeacherUser;
  password: string;
  credentialId: string;
  aliases?: readonly string[];
}

function accountsForSchool(school: SchoolConfig): DemoAccount[] {
  const suffix = school.code.toLowerCase();
  const teacher: TeacherUser = {id:school.code === 'ECMC' ? 'doc-001' : `demo-teacher-${suffix}`, name:'Profesor de prueba', email:'profesor@yachaytech.edu.ec', role:'teacher', rank:'Profesor', school:school.code, researchLines:[], createdAt:'2026-10-13'};
  return [
    {user:teacher, password:'Profesor2026!', credentialId:'doc-001'},
    {user:{id:`demo-student-${suffix}`, name:'Estudiante de prueba', email:'estudiante@yachaytech.edu.ec', role:'student', rank:'Estudiante colaborador', school:school.code, bio:`Estudiante colaborador de ${school.name}.`, createdAt:'2026-10-10'}, password:'Estudiante2026!', credentialId:'demo-student-ecmc', aliases:['estudiante.ecmc@yachaytech.edu.ec']},
    {user:{id:school.code === 'ECMC' ? 'demo-reviewer' : `demo-reviewer-${suffix}`, name:'Comité Científico', email:'comite@yachaytech.edu.ec', role:'reviewer_demo', rank:'Miembro del Comité', school:school.code, createdAt:'2026-09-30'}, password:'Comite2026!', credentialId:'demo-reviewer'},
  ];
}

// Shared credentials select a stable identity per school. Keep the existing ECMC
// IDs so saved products, role assignments and student collaborations still work.
const orderedSchools = [...SCHOOLS.filter(school => school.code === 'ECMC'), ...SCHOOLS.filter(school => school.code !== 'ECMC')];
const demoAccounts: DemoAccount[] = [
  ...orderedSchools.flatMap(accountsForSchool),
  {user:{id:'demo-developer', name:'Equipo de desarrollo', email:'desarrollo@yachaytech.edu.ec', role:'developer', rank:'Desarrollador', school:'ECMC', createdAt:'2026-09-30'}, password:'Equipo2026!', credentialId:'demo-developer'},
];

export const DEMO_ACCOUNTS = DEMO_ENABLED ? demoAccounts : [];

// Keep recognizing persisted demo identities even when their login is disabled.
export function isDemoAccount(identity: {id?: string; email?: string}): boolean {
  const email = identity.email?.trim().toLowerCase();
  return demoAccounts.some(({user, aliases}) => user.id === identity.id || user.email === email || aliases?.includes(email || ''));
}

export const canReview = (user: TeacherUser | null) => user?.role === 'developer' || user?.role === 'reviewer_demo';
export const canDevelop = (user: TeacherUser | null) => user?.role === 'developer';

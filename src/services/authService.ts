import { resolveRole } from './roleService';
import { DEMO_ACCOUNTS, DEMO_ENABLED, isDemoAccount } from '../constants/demoAccounts';
import { AcademicDegree, OfficialResearchLine, SchoolCode, TeacherResearchSublines, TeacherUser } from '../types';
import { storageService, STORAGE_KEYS, withStorageRollback } from './storage';
import { ALLOWED_EMAIL_DOMAIN, ALL_OFFICIAL_RESEARCH_LINES, OFFICIAL_RESEARCH_SUBLINES } from '../constants/researchLines';
import { getSchoolByCode } from '../constants/schools';

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  school: SchoolCode | '';
  orcid?: string;
  bio?: string;
}

export interface RegisterValidationErrors {
  name?: string;
  email?: string;
  password?: string;
  school?: string;
  orcid?: string;
  general?: string;
}

export interface TeacherProfileUpdate {
  name: string;
  rank: string;
  academicDegree: AcademicDegree;
  academicField?: string;
  researchLines?: OfficialResearchLine[];
  researchSublines?: TeacherResearchSublines;
  orcid?: string;
  githubUrl?: string;
  googleScholarId?: string;
  scopusAuthorId?: string;
  webOfScienceId?: string;
  bio?: string;
  profileImage?: string;
}

export interface StudentProfileUpdate {
  orcid?: string;
  githubUrl?: string;
  googleScholarId?: string;
  bio?: string;
  profileImage?: string;
}

type StudentProfileFields = Pick<TeacherUser, 'orcid' | 'githubUrl' | 'googleScholarId' | 'bio' | 'profileImage'>;
const STUDENT_PROFILES_KEY = 'red_papers_student_profiles_v1';
const SAVE_ERROR = 'No se pudieron guardar los cambios en este dispositivo. Revise el espacio disponible e inténtelo de nuevo.';

function readStudentProfiles(): Record<string, StudentProfileFields> {
  try {
    const value = JSON.parse(localStorage.getItem(STUDENT_PROFILES_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

function readCredentials(): Record<string, {passwordHash: string; updatedAt?: string}> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('red_papers_auth_creds_v1') || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, credential]) =>
      credential && typeof credential === 'object' && !Array.isArray(credential)
      && typeof credential.passwordHash === 'string'));
  }
  catch { return {}; }
}

function normalizeOrcid(value?: string): string | undefined {
  const clean = value?.trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, '').replace(/\/$/, '');
  return clean || undefined;
}

function normalizeGithub(value?: string): string | undefined {
  const clean = value?.trim();
  if (!clean) return undefined;
  const candidate = /^https?:\/\//i.test(clean) ? clean : `https://github.com/${clean.replace(/^@/, '')}`;
  try {
    const url = new URL(candidate);
    const username = url.pathname.split('/').filter(Boolean)[0];
    if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase()) || !username || !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username)) return undefined;
    return `https://github.com/${username}`;
  } catch { return undefined; }
}

function normalizeScholarId(value?: string): string | undefined {
  const clean = value?.trim();
  if (!clean) return undefined;
  if (/^https?:\/\//i.test(clean)) {
    try {
      const url = new URL(clean);
      if (!['scholar.google.com', 'www.scholar.google.com'].includes(url.hostname.toLowerCase())) return undefined;
      const id = url.searchParams.get('user');
      return id && /^[\w-]{4,}$/.test(id) ? id : undefined;
    } catch { return undefined; }
  }
  return /^[\w-]{4,}$/.test(clean) ? clean : undefined;
}

function normalizeScopusId(value?: string): string | undefined {
  const clean = value?.trim();
  if (!clean) return undefined;
  if (/^https?:\/\//i.test(clean)) {
    try {
      const url = new URL(clean);
      if (!['scopus.com', 'www.scopus.com'].includes(url.hostname.toLowerCase())) return undefined;
      const id = url.searchParams.get('authorId');
      return id && /^\d{6,12}$/.test(id) ? id : undefined;
    } catch { return undefined; }
  }
  return /^\d{6,12}$/.test(clean) ? clean : undefined;
}

function normalizeWebOfScienceId(value?: string): string | undefined {
  const clean = value?.trim();
  if (!clean) return undefined;
  if (/^https?:\/\//i.test(clean)) {
    try {
      const url = new URL(clean);
      if (!['webofscience.com', 'www.webofscience.com'].includes(url.hostname.toLowerCase())) return undefined;
      const match = url.pathname.match(/\/record\/([^/]+)/i);
      return match?.[1] && /^[a-z\d-]{4,30}$/i.test(match[1]) ? match[1] : undefined;
    } catch { return undefined; }
  }
  return /^[a-z\d-]{4,30}$/i.test(clean) ? clean : undefined;
}

/**
 * Validador de formato ORCID oficial (ej. 0000-0002-1825-0097)
 */
export function isValidOrcid(orcid?: string): boolean {
  if (!orcid || !orcid.trim()) return true; // Es opcional
  const orcidRegex = /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/;
  return orcidRegex.test(orcid.trim());
}

/**
 * SOLO DEMO: hash no criptográfico con sal fija; no protege contraseñas reales.
 * El prefijo sha256_sim_ es histórico y no representa SHA-256 ni PBKDF2.
 * WebCrypto PBKDF2 con sal aleatoria por usuario requiere migrar credenciales
 * y hacer asíncronos login/register/changePassword y sus formularios consumidores.
 * Se conserva el contrato síncrono de esta demo; no usar como seguridad de producción.
 */
function hashPassword(password: string): string {
  let hash = 0;
  const salt = 'ecmc_yachaytech_sec_salt_2026';
  const combined = password + salt;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `sha256_sim_${Math.abs(hash).toString(16)}`;
}

export const authService = {
  /**
   * Obtiene la sesión activa
   */
  getCurrentUser(): TeacherUser | null {
    const saved = storageService.getCurrentUser();
    if (!saved) return null;
    if (!DEMO_ENABLED && isDemoAccount(saved)) return null;
    const fixture = DEMO_ACCOUNTS.find(a=>a.user.id===saved.id);
    const storedTeacher = storageService.getTeachers().find(t=>t.id===saved.id);
    const studentProfile = fixture?.user.role === 'student' ? readStudentProfiles()[saved.id] : undefined;
    const base = fixture ? {...fixture.user, ...storedTeacher, ...saved, ...studentProfile, email:fixture.user.email, school:fixture.user.school, role:fixture.user.role} : saved;
    return resolveRole(base);
  },

  /**
   * Cierra la sesión activa
   */
  logout(): void {
    storageService.setCurrentUser(null);
  },

  /**
   * Inicio de sesión institucional (HU02)
   */
  login(email: string, password: string, school?: SchoolCode): { success: boolean; user?: TeacherUser; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, error: 'Por favor ingresa usuario/correo y contraseña.' };
    }
    if (!DEMO_ENABLED && isDemoAccount({email: cleanEmail})) {
      return {success:false,error:'Credenciales inválidas. Verifica tu correo y contraseña.'};
    }

    if (school && !getSchoolByCode(school)) return {success:false,error:'Seleccione una escuela válida.'};
    const account = DEMO_ACCOUNTS.find(a=>(a.user.email===cleanEmail || a.aliases?.includes(cleanEmail)) && a.user.school===(school || 'ECMC'));
    if(account){
      const credentials=readCredentials();
      const valid=credentials[account.credentialId]?.passwordHash
        ? credentials[account.credentialId].passwordHash===hashPassword(password)
        : password===account.password;
      if(!valid) return {success:false,error:'Credenciales inválidas. Verifica tu correo y contraseña.'};
      const teachers=storageService.getTeachers();
      const storedTeacher=teachers.find(t=>t.id===account.user.id);
      const studentProfile=account.user.role==='student' ? readStudentProfiles()[account.user.id] : undefined;
      const user=resolveRole({...account.user,...storedTeacher,...studentProfile,email:account.user.email,school:account.user.school,role:account.user.role});
      const saved=withStorageRollback([STORAGE_KEYS.TEACHERS,STORAGE_KEYS.CURRENT_USER],()=>{
        if(account.user.role==='teacher' && !storedTeacher && !storageService.saveTeachers([...teachers,user])) return false;
        return storageService.setCurrentUser(user);
      });
      if (!saved) return { success: false, error: SAVE_ERROR };
      return {success:true,user};
    }
    if (isDemoAccount({email:cleanEmail})) return {success:false,error:'Esta cuenta pertenece a otra escuela. Seleccione la escuela asociada a su cuenta.'};
    const teachers = storageService.getTeachers();
    const teacher = teachers.find((t) => t.email.toLowerCase() === cleanEmail);

    if (!teacher || (!DEMO_ENABLED && isDemoAccount(teacher))) {
      return {
        success: false,
        error: 'Credenciales inválidas. Verifica tu correo institucional y contraseña.',
      };
    }

    const credentials = readCredentials();
    const valid = credentials[teacher.id]
      ? credentials[teacher.id].passwordHash === hashPassword(password)
      : DEMO_ENABLED && password === '123456';
    if (!valid) return {success:false,error:'Credenciales inválidas. Verifica tu correo y contraseña.'};
    if (school && teacher.school !== school) return {success:false,error:'Esta cuenta pertenece a otra escuela. Seleccione la escuela asociada a su cuenta.'};
    const user = resolveRole(teacher);
    if (!storageService.setCurrentUser(user)) return { success: false, error: SAVE_ERROR };
    return { success: true, user };
  },

  /**
   * Registro de un nuevo profesor institucional (HU01)
   */
  register(formData: RegisterFormData): {
    success: boolean;
    user?: TeacherUser;
    error?: string;
    errors?: RegisterValidationErrors;
  } {
    const errors: RegisterValidationErrors = {};

    // 1. Validación de nombre
    if (!formData.name || formData.name.trim().length < 3) {
      errors.name = 'El nombre completo es obligatorio (mínimo 3 caracteres).';
    }

    // 2. Validación de correo institucional
    const cleanEmail = formData.email ? formData.email.trim().toLowerCase() : '';
    if (!cleanEmail) {
      errors.email = 'El correo institucional es obligatorio.';
    } else if (!/^[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*@yachaytech\.edu\.ec$/i.test(cleanEmail) || !cleanEmail.endsWith(ALLOWED_EMAIL_DOMAIN)) {
      errors.email = `Ingrese un correo institucional válido (${ALLOWED_EMAIL_DOMAIN}).`;
    } else {
      const teachers = storageService.getTeachers();
      const existing = teachers.find((t) => t.email.toLowerCase() === cleanEmail);
      if (existing || isDemoAccount({email: cleanEmail})) {
        errors.email = 'Ya existe un profesor registrado con este correo institucional.';
      }
    }

    // 3. Validación de contraseña
    if (!formData.password || formData.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres.';
    }

    // 4. ORCID opcional
    if (formData.orcid && !isValidOrcid(formData.orcid)) {
      errors.orcid = 'El formato de ORCID debe ser válido (ej. 0000-0002-1825-0097).';
    }

    const selectedSchool = getSchoolByCode(formData.school);
    if (!selectedSchool) errors.school = 'Seleccione una escuela válida.';

    if (Object.keys(errors).length > 0 || !selectedSchool) {
      return { success: false, errors };
    }

    // Guardado del usuario
    const teachers = storageService.getTeachers();
    const newId = `doc-${crypto.randomUUID()}`;
    const newUser: TeacherUser = {
      id: newId,
      name: formData.name.trim(),
      email: cleanEmail,
      rank: 'Profesor',
      orcid: formData.orcid ? formData.orcid.trim() : undefined,
      bio: formData.bio ? formData.bio.trim() : `Docente Investigador de la ${ALLOWED_EMAIL_DOMAIN}.`,
      school: selectedSchool.code,
      role: 'teacher',
      createdAt: new Date().toISOString(),
    };

    // Solo demo: se guarda el hash simulado, no la contraseña en texto plano.
    const secureAuthStore = readCredentials();
    secureAuthStore[newId] = {
      passwordHash: hashPassword(formData.password),
      updatedAt: new Date().toISOString(),
    };
    teachers.push(newUser);
    const saved = withStorageRollback(['red_papers_auth_creds_v1', STORAGE_KEYS.TEACHERS, STORAGE_KEYS.CURRENT_USER], () => {
      localStorage.setItem('red_papers_auth_creds_v1', JSON.stringify(secureAuthStore));
      return storageService.saveTeachers(teachers) && storageService.setCurrentUser(newUser);
    });
    if (!saved) return { success: false, error: SAVE_ERROR, errors: { general: SAVE_ERROR } };

    return { success: true, user: newUser };
  },

  updateProfile(data: TeacherProfileUpdate): {success:boolean; user?:TeacherUser; error?:string} {
    const current=this.getCurrentUser();
    if(!current || current.role!=='teacher') return {success:false,error:'Solo un profesor puede editar este perfil.'};
    const name=data.name.trim().replace(/^(?:(?:m\.?\s*sc|ph\.?\s*d|dr|dra|ing|mag)\.?)\s+/i,'').trim();
    const rank=data.rank.trim();
    const academicField=data.academicField?.trim();
    const researchLines=[...new Set(data.researchLines||[])];
    const researchSublines:TeacherResearchSublines={};
    for(const line of researchLines){
      const selected=[...new Set(data.researchSublines?.[line]||[])];
      if(selected.some(subline=>!(OFFICIAL_RESEARCH_SUBLINES[line]||[]).includes(subline))) return {success:false,error:'Seleccione sublíneas válidas para cada línea de investigación.'};
      if(selected.length) researchSublines[line]=selected;
    }
    const orcid=normalizeOrcid(data.orcid);
    const githubUrl=normalizeGithub(data.githubUrl);
    const googleScholarId=normalizeScholarId(data.googleScholarId);
    const scopusAuthorId=normalizeScopusId(data.scopusAuthorId);
    const webOfScienceId=normalizeWebOfScienceId(data.webOfScienceId);
    if(name.length<3) return {success:false,error:'Escriba su nombre completo (mínimo 3 caracteres).'};
    if(!rank) return {success:false,error:'Indique su cargo.'};
    if(!['PhD','MSc','BSc','Other'].includes(data.academicDegree)) return {success:false,error:'Seleccione su nivel de formación académica.'};
    if(data.academicDegree==='Other'&&!academicField) return {success:false,error:'Especifique su título académico.'};
    if((academicField?.length||0)>100) return {success:false,error:'El área de especialidad debe tener 100 caracteres o menos.'};
    if(data.profileImage&&(!/^data:image\/jpeg;base64,[a-z\d+/]+=*$/i.test(data.profileImage)||data.profileImage.length>1_500_000)) return {success:false,error:'La imagen de perfil no tiene un formato válido o es demasiado grande.'};
    const schoolLines=getSchoolByCode(current.school)?.researchLines||ALL_OFFICIAL_RESEARCH_LINES;
    if(researchLines.some(line=>!schoolLines.includes(line))) return {success:false,error:'Seleccione líneas de investigación válidas para su escuela.'};
    if(data.orcid?.trim() && !orcid) return {success:false,error:'El ORCID no tiene un formato válido.'};
    if(orcid && !isValidOrcid(orcid)) return {success:false,error:'El ORCID debe tener el formato 0000-0002-1825-0097.'};
    if(data.githubUrl?.trim() && !githubUrl) return {success:false,error:'Ingrese un usuario o enlace válido de GitHub.'};
    if(data.googleScholarId?.trim() && !googleScholarId) return {success:false,error:'Ingrese un ID o enlace válido de Google Scholar.'};
    if(data.scopusAuthorId?.trim() && !scopusAuthorId) return {success:false,error:'Ingrese un ID o enlace válido de Scopus.'};
    if(data.webOfScienceId?.trim() && !webOfScienceId) return {success:false,error:'Ingrese un ResearcherID o enlace válido de Web of Science.'};
    if((data.bio?.trim().length || 0)>500) return {success:false,error:'La biografía debe tener 500 caracteres o menos.'};
    const profileIdentifiers={githubUrl,googleScholarId,scopusAuthorId,webOfScienceId};
    const syntheticAcademicProfileFields=(['githubUrl','googleScholarId','scopusAuthorId','webOfScienceId'] as const)
      .filter(field=>current.syntheticAcademicProfileFields?.includes(field)&&current[field]===profileIdentifiers[field]);
    const updated:TeacherUser={...current,name,rank,academicDegree:data.academicDegree,academicField:academicField||undefined,profileImage:data.profileImage||undefined,researchLines,researchSublines,researchLine:researchLines[0],orcid,githubUrl,googleScholarId,scopusAuthorId,webOfScienceId,syntheticAcademicProfileFields,bio:data.bio?.trim()||undefined};
    const teachers=storageService.getTeachers();
    const index=teachers.findIndex(t=>t.id===current.id);
    if(index>=0) teachers[index]=updated; else teachers.push(updated);
    const saved=withStorageRollback([STORAGE_KEYS.TEACHERS,STORAGE_KEYS.CURRENT_USER],()=>
      storageService.saveTeachers(teachers)&&storageService.setCurrentUser(updated));
    if(!saved) return {success:false,error:SAVE_ERROR};
    return {success:true,user:updated};
  },

  updateStudentProfile(data: StudentProfileUpdate): {success:boolean; user?:TeacherUser; error?:string} {
    const current=this.getCurrentUser();
    if(!current || current.role!=='student') return {success:false,error:'Solo un estudiante puede editar este perfil.'};
    const orcid=normalizeOrcid(data.orcid);
    const githubUrl=normalizeGithub(data.githubUrl);
    const googleScholarId=normalizeScholarId(data.googleScholarId);
    const bio=data.bio?.trim();
    if(data.orcid?.trim() && (!orcid || !isValidOrcid(orcid))) return {success:false,error:'El ORCID debe tener el formato 0000-0002-1825-0097.'};
    if(data.githubUrl?.trim() && !githubUrl) return {success:false,error:'Ingrese un usuario o enlace válido de GitHub.'};
    if(data.googleScholarId?.trim() && !googleScholarId) return {success:false,error:'Ingrese un ID o enlace válido de Google Scholar.'};
    if((bio?.length||0)>500) return {success:false,error:'La descripción debe tener 500 caracteres o menos.'};
    if(data.profileImage && (!/^data:image\/jpeg;base64,[a-z\d+/]+=*$/i.test(data.profileImage) || data.profileImage.length>1_500_000)) return {success:false,error:'La imagen de perfil no tiene un formato válido o es demasiado grande.'};

    const profile:StudentProfileFields={orcid,githubUrl,googleScholarId,bio:bio||undefined,profileImage:data.profileImage||undefined};
    const updated:TeacherUser={...current,...profile,syntheticAcademicProfileFields:[]};
    const saved=withStorageRollback([STUDENT_PROFILES_KEY,STORAGE_KEYS.CURRENT_USER],()=>{
      localStorage.setItem(STUDENT_PROFILES_KEY,JSON.stringify({...readStudentProfiles(),[current.id]:profile}));
      return storageService.setCurrentUser(updated);
    });
    return saved ? {success:true,user:updated} : {success:false,error:SAVE_ERROR};
  },

  changePassword(currentPassword:string, newPassword:string): {success:boolean; error?:string} {
    const current=this.getCurrentUser();
    if(!current || current.role!=='teacher') return {success:false,error:'Solo un profesor puede cambiar esta contraseña.'};
    if(!currentPassword || !newPassword) return {success:false,error:'Complete la contraseña actual y la nueva.'};
    if(newPassword.length<6) return {success:false,error:'La nueva contraseña debe tener al menos 6 caracteres.'};
    const credentials=readCredentials();
    const fixture=DEMO_ACCOUNTS.find(a=>a.user.id===current.id);
    const credentialId=fixture?.credentialId || current.id;
    const valid=credentials[credentialId]?.passwordHash
      ? credentials[credentialId].passwordHash===hashPassword(currentPassword)
      : DEMO_ENABLED && (fixture ? currentPassword===fixture.password : currentPassword==='123456');
    if(!valid) return {success:false,error:'La contraseña actual no es correcta.'};
    try {
      credentials[credentialId]={passwordHash:hashPassword(newPassword),updatedAt:new Date().toISOString()};
      localStorage.setItem('red_papers_auth_creds_v1',JSON.stringify(credentials));
      return {success:true};
    } catch { return {success:false,error:'No se pudo guardar la contraseña. Inténtelo de nuevo.'}; }
  },

  /**
   * Cambiar de docente activo para pruebas en modo demostración
   */
  switchDemoUser(teacherId: string): TeacherUser | null {
    if (!DEMO_ENABLED) return null;
    if (this.getCurrentUser()?.role !== 'developer') return null;
    const teachers = storageService.getTeachers();
    const found = teachers.find((t) => t.id === teacherId);
    if (found) {
      if (!storageService.setCurrentUser(found)) return null;
      return found;
    }
    return null;
  },
};

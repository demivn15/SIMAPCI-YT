import { TeacherUser } from '../types';
import { DEMO_ACCOUNTS } from '../constants/demoAccounts';
import { storageService } from './storage';
type Role = TeacherUser['role'];
const key = 'red_papers_roles_v1';
export const ROLE_LABELS: Record<Role,string> = {teacher:'Profesor', student:'Estudiante', reviewer_demo:'Comité Científico', developer:'Desarrollador'};
function assignments(): Record<string,Role> {
  try { const data=JSON.parse(localStorage.getItem(key)||'{}'); return data && typeof data==='object' && !Array.isArray(data)?data:{}; } catch { return {}; }
}
export function resolveRole(user: TeacherUser): TeacherUser {
  const stored = assignments()[user.id];
  const base = DEMO_ACCOUNTS.find(a=>a.user.id===user.id)?.user.role || 'teacher';
  return {...user, role:Object.hasOwn(ROLE_LABELS,stored) ? stored : base};
}
export const roleService = {
  users(): TeacherUser[] {
    const users = new Map(storageService.getTeachers().map(u=>[u.id,u]));
    DEMO_ACCOUNTS.filter(a=>a.user.role!=='student').forEach(a=>users.set(a.user.id,a.user));
    return [...users.values()].map(resolveRole);
  },
  assign(id:string, role:Role): {success:boolean; error?:string} {
    const session=storageService.getCurrentUser();
    const actor=session && resolveRole(session).role;
    if(!session || actor!=='developer') return {success:false,error:'No tiene permiso para asignar roles.'};
    if(!Object.hasOwn(ROLE_LABELS,role)) return {success:false,error:'Rol no válido.'};
    const users=this.users(), target=users.find(u=>u.id===id);
    if(!target) return {success:false,error:'Usuario no encontrado.'};
    if(target.role==='developer' || role==='developer') return {success:false,error:'Esta herramienta no modifica cuentas de desarrolladores.'};
    if(actor==='developer' && (role!=='reviewer_demo' && target.role!=='reviewer_demo')) return {success:false,error:'El desarrollador puede asignar o retirar miembros del comité.'};
    try {
      localStorage.setItem(key,JSON.stringify({...assignments(),[id]:role}));
      if(session.id===id) storageService.setCurrentUser({...session,role});
      return {success:true};
    } catch { return {success:false,error:'No se pudo guardar el cambio. Inténtelo de nuevo.'}; }
  }
};


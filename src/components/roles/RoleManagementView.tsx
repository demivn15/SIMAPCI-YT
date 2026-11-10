import React, {useState} from 'react';
import {roleService, ROLE_LABELS} from '../../services/roleService';
import {TeacherUser} from '../../types';
export function RoleManagementView({onChanged,currentUser}:{onChanged:()=>void;currentUser:TeacherUser}) {
 const developer=currentUser.role==='developer';
 const choices=(user:TeacherUser):TeacherUser['role'][]=>developer?(user.role==='reviewer_demo'?['reviewer_demo','teacher']:[user.role,'reviewer_demo']):['teacher'];
 const [users,setUsers]=useState(()=>roleService.users());
 const [query,setQuery]=useState('');
 const [searchDraft,setSearchDraft]=useState('');
 const [pending,setPending]=useState<{user:TeacherUser;role:TeacherUser['role']}|null>(null);
 const [message,setMessage]=useState('');
 const save=()=>{
  if(!pending)return;
  const result=roleService.assign(pending.user.id,pending.role);
  if(!result.success){setMessage(result.error||'No se pudo guardar.');return;}
  setMessage(`Rol de ${pending.user.name} actualizado a ${ROLE_LABELS[pending.role]}.`);
  setUsers(roleService.users());setPending(null);onChanged();
 };
 const filtered=users.filter(u=>u.role==='teacher'||(developer&&u.role==='reviewer_demo')).filter(u=>`${u.name} ${u.email} ${u.school}`.toLowerCase().includes(query.toLowerCase()));
 return <section className="roles-page">
  <div className="reviewer-heading"><p className="eyebrow">ADMINISTRACIÓN · {currentUser.school}</p><h1>{developer?'Asignar comité':'Asignar roles'}</h1><p>{developer?'Asigne miembros al comité o devuélvales el perfil de profesor.':'Asigne a cada usuario el perfil de profesor.'}</p></div>
  <input className="roles-search" aria-label="Buscar usuario" placeholder="Nombre o correo · Enter" value={searchDraft} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();setQuery(searchDraft.trim());}}} onChange={e=>setSearchDraft(e.target.value)}/>
  {message&&<p role="status" className="save-notice">{message}</p>}
  {pending&&<div className="role-confirm" role="region" aria-label="Confirmar cambio de rol"><p><strong>{pending.user.name} ({pending.user.school})</strong> pasará de {ROLE_LABELS[pending.user.role]} a <strong>{ROLE_LABELS[pending.role]}</strong>.</p><p>El nuevo perfil determina las herramientas disponibles al iniciar sesión.</p><div><button className="primary-button" onClick={save}>Confirmar cambio</button><button onClick={()=>setPending(null)}>Cancelar</button></div></div>}
  <div className="role-users">{filtered.map(u=><article key={u.id} className="role-user"><div><h2>{u.name}</h2><p>{u.email}</p><small>Actual: {ROLE_LABELS[u.role]} | Escuela: {u.school}</small></div><label>Asignar perfil<select aria-label={`Rol de ${u.name} (${u.school})`} value={pending?.user.id===u.id?pending.role:u.role} onChange={e=>{setMessage('');setPending(e.target.value===u.role?null:{user:u,role:e.target.value as TeacherUser['role']});}}>{choices(u).map(value=><option key={value} value={value}>{ROLE_LABELS[value]}</option>)}</select></label></article>)}{filtered.length===0&&<p>No se encontraron usuarios.</p>}</div>
 </section>;
}

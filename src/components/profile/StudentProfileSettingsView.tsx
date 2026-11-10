import React, {ChangeEvent, FormEvent, useRef, useState} from 'react';
import {CircleCheck, ExternalLink, ImagePlus, Save, Trash2, UserRound} from 'lucide-react';
import {TeacherUser} from '../../types';
import {authService} from '../../services/authService';

type Props={currentUser:TeacherUser; onUpdated:(user:TeacherUser)=>void};

async function optimizeProfileImage(file:File):Promise<string>{
 const supportedTypes=['image/jpeg','image/png','image/webp'];
 if(!supportedTypes.includes(file.type)) throw new Error('Elija una imagen JPG, PNG o WebP.');
 if(file.size>5*1024*1024) throw new Error('La imagen debe pesar 5 MB o menos.');
 const source=await new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('No se pudo leer la imagen.'));
  reader.onerror=()=>reject(new Error('No se pudo leer la imagen.'));
  reader.readAsDataURL(file);
 });
 return new Promise<string>((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>{
   const size=512;
   const canvas=document.createElement('canvas');
   canvas.width=size;canvas.height=size;
   const context=canvas.getContext('2d');
   if(!context){reject(new Error('No se pudo preparar la imagen.'));return;}
   const scale=Math.max(size/image.naturalWidth,size/image.naturalHeight);
   const width=image.naturalWidth*scale;
   const height=image.naturalHeight*scale;
   context.drawImage(image,(size-width)/2,(size-height)/2,width,height);
   resolve(canvas.toDataURL('image/jpeg',.8));
  };
  image.onerror=()=>reject(new Error('El archivo no contiene una imagen válida.'));
  image.src=source;
 });
}

export function StudentProfileSettingsView({currentUser,onUpdated}:Props) {
 const [profileImage,setProfileImage]=useState(currentUser.profileImage);
 const [orcid,setOrcid]=useState(currentUser.syntheticAcademicProfileFields?.includes('orcid')?'':currentUser.orcid||'');
 const [githubUrl,setGithubUrl]=useState(currentUser.syntheticAcademicProfileFields?.includes('githubUrl')?'':currentUser.githubUrl||'');
 const [googleScholarId,setGoogleScholarId]=useState(currentUser.syntheticAcademicProfileFields?.includes('googleScholarId')?'':currentUser.googleScholarId||'');
 const [bio,setBio]=useState(currentUser.bio||'');
 const [profileMessage,setProfileMessage]=useState('');
 const [profileError,setProfileError]=useState('');
 const [photoError,setPhotoError]=useState('');
 const fileInput=useRef<HTMLInputElement>(null);

 const handlePhotoChange=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];
  if(!file) return;
  setPhotoError('');setProfileMessage('');
  try{setProfileImage(await optimizeProfileImage(file));}
  catch(error){setPhotoError(error instanceof Error?error.message:'No se pudo cargar la imagen.');}
  finally{event.target.value='';}
 };

 const saveProfile=(event:FormEvent)=>{
  event.preventDefault();setProfileMessage('');setProfileError('');
  const result=authService.updateStudentProfile({orcid,githubUrl,googleScholarId,bio,profileImage});
  if(!result.success||!result.user){setProfileError(result.error||'No se pudo actualizar el perfil.');return;}
  onUpdated(result.user);setProfileMessage('La información del perfil se actualizó.');
 };

 return <section className="profile-settings-page" aria-labelledby="student-profile-settings-title">
  <div className="reviewer-heading">
   <p className="eyebrow">MI CUENTA · {currentUser.school}</p>
   <h1 id="student-profile-settings-title">Configuración del perfil</h1>
   <p>Actualiza tu descripción, foto y enlaces académicos.</p>
  </div>
  <div className="profile-settings-identity"><span className="profile-settings-avatar">{profileImage?<img src={profileImage} alt=""/>:<UserRound size={25}/>}</span><div><strong>{currentUser.name}</strong><span>{currentUser.email}</span><small>Estudiante · {currentUser.school}</small></div></div>

  <form className="profile-settings-card" onSubmit={saveProfile}>
   <div className="profile-settings-card-heading"><div><p className="eyebrow">PERFIL ESTUDIANTIL</p><h2>Información de contacto académico</h2></div><p>Los datos de identidad institucional se administran por separado.</p></div>
   <div className="profile-settings-grid">
    <div className="profile-settings-photo-field profile-settings-field-wide">
     <span>Foto de perfil</span>
     <div className="profile-settings-photo-editor">
      <span className="profile-settings-avatar profile-settings-avatar-large">{profileImage?<img src={profileImage} alt="Vista previa de la foto de perfil"/>:<UserRound size={31}/>}</span>
      <div className="profile-settings-photo-controls"><strong>Tu foto de perfil</strong><small>JPG, PNG o WebP. Máximo 5 MB; la imagen se ajusta automáticamente.</small><div className="profile-settings-photo-actions"><button type="button" className="profile-photo-button" onClick={()=>fileInput.current?.click()}><ImagePlus size={17}/>{profileImage?'Cambiar imagen':'Elegir imagen'}</button>{profileImage&&<button type="button" className="profile-photo-button is-secondary" onClick={()=>{setProfileImage(undefined);setPhotoError('');}}><Trash2 size={16}/>Quitar</button>}</div><input ref={fileInput} className="profile-image-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Elegir imagen de perfil" onChange={handlePhotoChange}/></div>
     </div>
     {photoError&&<small className="profile-photo-error" role="alert">{photoError}</small>}
    </div>
    <label className="profile-settings-field"><span>ORCID iD</span><input placeholder="0000-0002-1825-0097" autoComplete="off" value={orcid} onChange={e=>setOrcid(e.target.value)}/><small>Acepta tu iD o el enlace de ORCID.</small></label>
    <label className="profile-settings-field"><span>GitHub</span><input placeholder="usuario o github.com/usuario" autoComplete="url" value={githubUrl} onChange={e=>setGithubUrl(e.target.value)}/><small>Enlace a tu perfil público.</small></label>
    <label className="profile-settings-field profile-settings-field-wide"><span>Google Scholar ID</span><input placeholder="ID o enlace del perfil" autoComplete="off" value={googleScholarId} onChange={e=>setGoogleScholarId(e.target.value)}/><small>Puedes pegar el enlace completo; guardaremos el identificador.</small></label>
    <label className="profile-settings-field profile-settings-field-wide"><span>Descripción</span><textarea rows={4} maxLength={500} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Cuéntanos sobre tus intereses y experiencia académica."/><small>{bio.length}/500 caracteres</small></label>
   </div>
   {profileError&&<p className="profile-form-message is-error" role="alert">{profileError}</p>}
   {profileMessage&&<p className="profile-form-message is-success" role="status"><CircleCheck size={18}/>{profileMessage}</p>}
   <div className="profile-settings-actions"><button className="primary-button" type="submit"><Save size={18}/>Guardar perfil</button></div>
  </form>
  {(currentUser.orcid||currentUser.githubUrl||currentUser.googleScholarId)&&<div className="profile-links-note"><ExternalLink size={17}/><span>Los enlaces guardados aparecerán en tu perfil académico.</span></div>}
 </section>;
}

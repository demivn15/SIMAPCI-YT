import React, {useState,useEffect} from 'react';
import {ArrowLeft,ArrowRight,LogIn} from 'lucide-react';
import {SchoolConfig} from '../../constants/schools';
import type {SchoolMetrics} from '../../types';
import {YachayLogo} from '../institutional/SchoolLogo';
import {LoginSchoolEmblem} from './LoginSchoolEmblem';
import {LoginDialog} from './LoginDialog';
interface AccessScreenProps {
 school:SchoolConfig; schoolMetrics:SchoolMetrics; teacherCount:number; onLogin:(email:string,pass:string)=>{success:boolean;error?:string}; onExploreAsGuest:()=>void; onChangeSchool:()=>void;
}
export const AccessScreen:React.FC<AccessScreenProps>=(p)=>{
 const [loginOpen,setLoginOpen]=useState(false);
 const [compactArt,setCompactArt]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 760px)').matches);
 useEffect(()=>{
  const query=window.matchMedia('(max-width: 760px)');
  const update=()=>setCompactArt(query.matches);
  update();
  query.addEventListener?.('change',update);
  return()=>query.removeEventListener?.('change',update);
 },[]);
 const artLayers=compactArt?13:49;
 const artLayerSpacing=compactArt?4:1;
 return <div className="welcome-access" style={{'--school-accent':p.school.accent,'--school-ink':`color-mix(in srgb, ${p.school.accent} 46%, #252321)`,'--accent':`color-mix(in srgb, ${p.school.accent} 46%, #252321)`} as React.CSSProperties}>
  <header className="welcome-access-header">
   <div className="welcome-access-brand"><YachayLogo width={130}/><span>SIMAPC<small>{p.school.shortName}</small></span></div>
   <nav aria-label="Acceso a la plataforma"><button type="button" className="welcome-school-switch" onClick={p.onChangeSchool}><ArrowLeft size={17} aria-hidden="true"/>Cambiar escuela</button><button type="button" className="welcome-login-trigger" onClick={()=>setLoginOpen(true)}><LogIn size={20} aria-hidden="true"/>Iniciar sesión</button></nav>
  </header>
  <main className="welcome-access-main">
   <div className="welcome-access-content">
    <p className="welcome-access-kicker">EL CONOCIMIENTO NOS CONECTA</p>
    <h1>Un espacio para<br/><em>su investigación.</em></h1>
    <p className="welcome-access-description">Publicaciones, proyectos y la comunidad científica de nuestra escuela.</p>
    <button className="welcome-public" onClick={p.onExploreAsGuest}><span><strong>Consultar sin iniciar sesión</strong><small>Explore el catálogo y las estadísticas públicas.</small></span><ArrowRight size={24} aria-hidden="true"/></button>
    {p.school.code==='ECMC'?<dl className="welcome-access-dean">
     <dt>Decano</dt>
     <dd>Franklin Camacho, Ph.D.</dd>
    </dl>:<dl className="welcome-access-metrics" aria-label={`Cifras de ${p.school.shortName}`}>
     <div><dt>Publicaciones</dt><dd>{p.schoolMetrics.totalPublications}</dd></div>
     <div><dt>Proyectos</dt><dd>{p.schoolMetrics.totalProjects}</dd></div>
     <div><dt>Docentes</dt><dd>{p.teacherCount}</dd></div>
     <div><dt>Líneas con producción</dt><dd>{p.schoolMetrics.researchLinesWithProduction}</dd></div>
    </dl>}
   </div>
   <div className="welcome-art" aria-hidden="true" data-school={p.school.code}>
   <div className="welcome-emblem-tilt"><div className="welcome-emblem-solid">
    {Array.from({length:artLayers},(_,layer)=>{
     const isFace=layer===0||layer===artLayers-1;
     const depth=(layer-(artLayers-1)/2)*artLayerSpacing;
     return <div key={layer} className={`welcome-emblem-layer ${isFace?'emblem-face':'emblem-edge'}`} style={{transform:`translateZ(${depth}px)`}}>
      <LoginSchoolEmblem school={p.school} size={340}/>
     </div>;
    })}
   </div></div>
   </div>
  </main>
  <footer className="welcome-access-footer"><span>{p.school.name}</span><span>Investigación · {p.school.code}</span></footer>
  <LoginDialog isOpen={loginOpen} onClose={()=>setLoginOpen(false)} onLogin={p.onLogin}/>
 </div>;
};

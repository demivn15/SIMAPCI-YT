import React from 'react';
import { BookOpen, FolderOpen, FolderPlus, Search, ShieldCheck } from 'lucide-react';
interface Props { showActions?:boolean; allowRegister?:boolean; primary?:boolean; onReview?:()=>void; onViewRecords?:()=>void; onOpenRegister: (type: 'publicacion'|'proyecto')=>void; onBrowse:()=>void; }
export const InstitutionalBanner:React.FC<Props>=({onOpenRegister,onBrowse,onReview,onViewRecords,primary=false,allowRegister=true,showActions=true})=>{
 if (!showActions) return null;
 const Heading = primary ? 'h1' : 'h2';
 return <section className={`home-welcome dashboard-actions${primary ? ' dashboard-actions-primary' : ''}`} aria-labelledby="dashboard-actions-title">
 <Heading id="dashboard-actions-title" className="action-heading">Accesos rápidos</Heading>
 <div className={`home-actions ${!allowRegister?(onReview?"home-actions-review":"home-actions-single"):""}`}>
  {allowRegister&&<><button onClick={()=>onOpenRegister('publicacion')}><span className="action-icon"><BookOpen/></span><strong>Registrar publicación</strong><span>Artículos, libros y otros trabajos publicados</span></button>
  <button onClick={()=>onOpenRegister('proyecto')}><span className="action-icon"><FolderPlus/></span><strong>Registrar proyecto</strong><span>Agregue su proyecto de investigación</span></button></>}
  {onViewRecords&&<button onClick={onViewRecords}><span className="action-icon"><FolderOpen/></span><strong>Mis registros</strong><span>Revise y actualice sus publicaciones y proyectos</span></button>}
  <button onClick={onBrowse}><span className="action-icon"><Search/></span><strong>Consultar producción</strong><span>Busque por título, autor o tema</span></button>
  {onReview&&<button onClick={onReview}><span className="action-icon"><ShieldCheck/></span><strong>Revisión académica</strong><span>Revise y verifique publicaciones y proyectos</span></button>}
 </div>
</section>;};

import React, { useEffect, useState } from 'react';
import { AcademicDegree, SyntheticAcademicProfileField, TeacherUser, ScientificProduct } from '../../types';
import { metricsService } from '../../services/metricsService';
import { exportService, ExportMetadata } from '../../services/exportService';
import { productDateLabel, productMatchesTeacher, productCitationValue } from '../../services/productPresentation';
import { ProductDetailModal } from '../catalog/ProductDetailModal';
import { Search, ExternalLink, Mail, Download, BarChart3, ArrowLeft, ChevronRight } from 'lucide-react';
import { getSchoolByCode } from '../../constants/schools';
import juanPhoto from '../../assets/researchers/juan-pablo-astudillo.png';
import diegoPhoto from '../../assets/researchers/diego-peluffo.png';
import eugenioPhoto from '../../assets/researchers/eugenio-morocho.png';
import jeffersonPhoto from '../../assets/researchers/jefferson-moreno-guaicha.png';
import rigobertoPhoto from '../../assets/researchers/rigoberto-fonseca-delgado.png';
const degreeLabels:Record<AcademicDegree,string>={PhD:'Doctorado (PhD)',MSc:'Maestría (MSc)',BSc:'Licenciatura o Ingeniería',Other:'Otro título'};
const academicProfileLink=(teacher:TeacherUser,field:SyntheticAcademicProfileField,label:string,href:string)=>{
 if(!teacher[field]) return null;
 const rawValue=teacher[field]||'';
 const value=field==='githubUrl'?rawValue.replace(/^https?:\/\/(www\.)?github\.com\//i,'@'):rawValue;
 const labelWithValue=`${label} · ${value}`;
 if(teacher.syntheticAcademicProfileFields?.includes(field)) return <span className="academic-profile-unlinked">{label} · {value}</span>;
 return <a href={href} target="_blank" rel="noopener noreferrer">{labelWithValue}<ExternalLink size={15} aria-hidden="true"/></a>;
};
const academicTitle = (teacher:TeacherUser) => {
 if(!teacher.academicDegree) return undefined;
 const label=degreeLabels[teacher.academicDegree];
 return teacher.academicField
  ? teacher.academicDegree==='Other'?`${label}: ${teacher.academicField}`:`${label} en ${teacher.academicField}`
  : label;
};
const portrait = (teacher: TeacherUser) => {
 if(teacher.profileImage) return teacher.profileImage;
 const name=teacher.name.toLowerCase();
 if(teacher.orcid==='0000-0002-0380-4739' || name.includes('jefferson') || name.includes('jeferzon')) return jeffersonPhoto;
 if(teacher.orcid==='0000-0002-7291-3584' || name.includes('juan pablo') && name.includes('astudillo')) return juanPhoto;
 if(teacher.orcid==='0000-0002-8890-3911' || name.includes('rigoberto') && name.includes('fonseca')) return rigobertoPhoto;
 if(name.includes('diego') && name.includes('peluffo')) return diegoPhoto;
 if(name.includes('eugenio') && name.includes('morocho')) return eugenioPhoto;
 return undefined;
};


interface DirectoryViewProps {
  teachers: TeacherUser[];
  allProducts: ScientificProduct[];
  selectedTeacherId?: string;
  onFilterInCatalog: (teacherId: string) => void;
  schoolCode?: string;
}

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  teachers,
  allProducts,
  selectedTeacherId,
  onFilterInCatalog,
  schoolCode = 'ECMC',
}) => {
  const schoolName=getSchoolByCode(schoolCode)?.name||schoolCode;
  const [activeTeacherId, setActiveTeacherId] = useState<string>(
    selectedTeacherId || teachers[0]?.id || 'doc-001'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingProduct, setViewingProduct] = useState<ScientificProduct | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);

  useEffect(() => {
    if (!mobileProfileOpen || !window.matchMedia('(max-width: 1000px)').matches) return;

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileProfileOpen, activeTeacherId]);

  // Filtrado de la lista izquierda
  const filteredTeachers = teachers.filter((t) => {
    const q = searchQuery.trim().toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.rank.toLowerCase().includes(q) ||
      (t.academicDegree&&degreeLabels[t.academicDegree].toLowerCase().includes(q)) ||
      (t.academicField&&t.academicField.toLowerCase().includes(q)) ||
      Object.values(t.researchSublines||{}).flat().some(subline=>subline.toLowerCase().includes(q)) ||
      t.email.toLowerCase().includes(q) ||
      (t.bio && t.bio.toLowerCase().includes(q))
    );
  });

  // Mantener el perfil dentro de los resultados, sin mostrar uno ajeno al filtro.
  const activeTeacher = filteredTeachers.find((teacher) => teacher.id === activeTeacherId) || filteredTeachers[0];

  // Métricas del docente seleccionado
  const activeTeacherMetrics = activeTeacher
    ? metricsService.calculateTeacherMetrics(activeTeacher, allProducts.filter(product=>product.status==='verificado'))
    : null;

  // Productos del docente seleccionado
  const teacherProducts = allProducts.filter((p) => {
    if (p.status !== 'verificado') return false;
    if (!activeTeacher) return false;
    return productMatchesTeacher(p, activeTeacher);
  });
  const importedProfile = activeTeacher?.id.startsWith('ecmc-orcid-researcher-') || teacherProducts.some(product => product.bibliographicSource);
  const hasTemporaryLineSuggestions = teacherProducts.some(product => product.bibliographicSource?.researchLineClassification);
  const citationsAvailable = !teacherProducts.length || teacherProducts.some(product => productCitationValue(product) !== null);
  const teacherResearchLines = activeTeacher
    ? activeTeacher.researchLines?.length
      ? activeTeacher.researchLines
      : activeTeacher.researchLine
      ? [activeTeacher.researchLine]
      : [...new Set(teacherProducts.map(product=>product.researchLine).filter(line => line !== ''))]
    : [];
  const annualResearchCounts = (()=>{
    const lastYear=importedProfile && teacherProducts.length ? Math.max(...teacherProducts.map(product => product.year)) : new Date().getFullYear();
    return Array.from({length:5},(_,index)=>{
      const year=lastYear-4+index;
      return {year,count:teacherProducts.filter(product=>product.year===year).length};
    });
  })();
  const maxAnnualResearchCount=Math.max(1,...annualResearchCounts.map(item=>item.count));

  // Exportaciones de este docente
  const handleTeacherExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!activeTeacher || (format !== 'pdf' && teacherProducts.length === 0)) {
      setExportNotice('No hay productos para exportar en este formato.');
      setTimeout(() => setExportNotice(null), 3000);
      return;
    }

    const meta: ExportMetadata = {
      filters: {
        searchQuery: '',
        productType: 'todos',
        teacherId: activeTeacher.id,
        periodYear: 'todos',
        researchLine: 'todas',
        status: 'todos',
      },
      totalRecords: teacherProducts.length,
      generatedAt: new Date().toLocaleString('es-EC'),
      institution: 'Universidad Yachay Tech',
      school: `Historial de ${activeTeacher.name} - ${schoolCode}`,
    };

    let success = false;
    const fileName = `historial_${activeTeacher.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    if (format === 'csv') {
      success = exportService.exportToCsv(teacherProducts, meta, `${fileName}.csv`);
    } else if (format === 'xlsx') {
      success = exportService.exportToExcel(teacherProducts, meta, `${fileName}.xlsx`);
    } else if (format === 'pdf') {
      success = await exportService.exportTeacherCv(activeTeacher, teacherProducts, activeTeacherMetrics!, meta.generatedAt);
    }

    if (success) {
      setExportNotice(format === 'pdf' ? 'Currículum del docente listo para imprimir o guardar en PDF.' : `Historial exportado en formato ${format.toUpperCase()}.`);
    } else {
      setExportNotice('Hubo un error al generar la exportación.');
    }
    setTimeout(() => setExportNotice(null), 3000);
  };

  return <section className="academic-directory">
    <header className="academic-directory-heading">
      <div><h2>Docentes e investigadores</h2></div>
      <div className="academic-search"><Search size={19} aria-hidden="true"/><input aria-label="Buscar docente" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/></div>
    </header>
    {exportNotice&&<p role="status" className="save-notice">{exportNotice}</p>}
    <div className="academic-directory-layout" data-mobile-profile-open={mobileProfileOpen}>
      <nav className="academic-people" aria-label="Seleccionar docente">
        {filteredTeachers.map(t=><button key={t.id} type="button" className={t.id===activeTeacher?.id?'selected':''} aria-pressed={t.id===activeTeacher?.id} onClick={()=>{setActiveTeacherId(t.id);setMobileProfileOpen(true);}}><span>{t.name}</span><small>{t.rank || (t.id.startsWith('ecmc-orcid-researcher-') ? 'Perfil importado de ORCID' : '')}{academicTitle(t)?`${t.rank ? ' · ' : ''}${academicTitle(t)}`:''}</small><ChevronRight className="academic-person-open-icon" size={18} aria-hidden="true"/></button>)}
        {!filteredTeachers.length&&<p className="academic-empty">No se encontraron docentes.</p>}
      </nav>
      {activeTeacher&&activeTeacherMetrics?<article className="academic-profile" key={activeTeacher.id}>
        <button type="button" className="academic-mobile-back" onClick={()=>setMobileProfileOpen(false)}><ArrowLeft size={17} aria-hidden="true"/>Todos los docentes</button>
        <header className="academic-profile-heading">
          {portrait(activeTeacher)?<img className="academic-avatar" src={portrait(activeTeacher)} alt={activeTeacher.name}/>:<span className="academic-avatar academic-initial" aria-hidden="true">{activeTeacher.name.split(' ')[1]?.charAt(0)||activeTeacher.name.charAt(0)}</span>}
          <div><h3>{activeTeacher.name}</h3>{activeTeacher.rank&&<p>{activeTeacher.rank}</p>}{academicTitle(activeTeacher)&&<p className="academic-degree">{academicTitle(activeTeacher)}</p>}<p className="academic-school">{importedProfile ? 'Perfil importado de ORCID' : schoolName}</p>{activeTeacher.yachayEntryYear&&<p className="academic-entry-year">En Yachay Tech desde {activeTeacher.yachayEntryYear}</p>}</div>
        </header>
        <div className="academic-profile-body">
          <section className="academic-profile-section academic-research-section" aria-labelledby="academic-research-line-title">
            <h4 id="academic-research-line-title">Línea de investigación</h4>
            {hasTemporaryLineSuggestions&&<p className="academic-section-empty">Líneas sugeridas temporalmente a partir de las publicaciones importadas; el perfil ORCID no las declara.</p>}
            {teacherResearchLines.length?<div className="academic-research-groups">{teacherResearchLines.map(line=><div className="academic-research-group" key={line}><strong>{line}</strong>{activeTeacher.researchSublines?.[line]?.length?<ul>{activeTeacher.researchSublines[line]?.map(subline=><li key={subline}>{subline}</li>)}</ul>:null}</div>)}</div>:<p className="academic-section-empty">Este docente aún no ha registrado una línea de investigación.</p>}
          </section>
          <aside className="academic-year-chart" aria-labelledby="academic-year-chart-title">
            <div className="academic-year-chart-heading"><div><span>PRODUCCIÓN ACADÉMICA</span><h4 id="academic-year-chart-title">Investigaciones por año</h4></div><BarChart3 size={20} aria-hidden="true"/></div>
            {annualResearchCounts.length?<>
              <div className="academic-year-bars" role="img" aria-label={annualResearchCounts.map(item=>`${item.year}: ${item.count} registros`).join('; ')}>
                {annualResearchCounts.map(item=><div className="academic-year-bar-column" key={item.year} title={`${item.year}: ${item.count} registros`}><strong>{item.count}</strong><div className="academic-year-bar-track"><span style={{height:`${item.count?Math.max(8,item.count/maxAnnualResearchCount*100):0}%`}}/></div><small>{item.year}</small></div>)}
              </div>
              <p className="academic-year-chart-note">Publicaciones y proyectos registrados · {teacherProducts.length} en total</p>
            </>:<p className="academic-year-chart-empty">Aún no hay investigaciones para mostrar.</p>}
          </aside>
        </div>
        <section className="academic-profile-section academic-description-section" aria-labelledby="academic-description-title">
          <h4 id="academic-description-title">Descripción del docente</h4>
          {activeTeacher.bio?<p className="academic-bio">{activeTeacher.bio}</p>:<p className="academic-section-empty">{importedProfile ? 'Descripción no disponible en la fuente ORCID.' : 'Este docente aún no ha añadido una descripción.'}</p>}
        </section>
        <div className="academic-contact">
          {activeTeacher.email&&<a href={`mailto:${activeTeacher.email}`}><Mail size={18} aria-hidden="true"/>{activeTeacher.email}</a>}
          {activeTeacher.orcid?activeTeacher.syntheticAcademicProfileFields?.includes('orcid')?<span className="academic-profile-unlinked">ORCID · {activeTeacher.orcid}</span>:<a href={`https://orcid.org/${activeTeacher.orcid}`} target="_blank" rel="noopener noreferrer">ORCID · {activeTeacher.orcid}<ExternalLink size={15} aria-hidden="true"/></a>:<span>ORCID no registrado</span>}
          {academicProfileLink(activeTeacher,'githubUrl','GitHub',activeTeacher.githubUrl||'')}
          {academicProfileLink(activeTeacher,'googleScholarId','Google Scholar',`https://scholar.google.com/citations?user=${encodeURIComponent(activeTeacher.googleScholarId||'')}`)}
          {academicProfileLink(activeTeacher,'scopusAuthorId','Scopus',`https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(activeTeacher.scopusAuthorId||'')}`)}
          {academicProfileLink(activeTeacher,'webOfScienceId','Web of Science',`https://www.webofscience.com/wos/author/record/${encodeURIComponent(activeTeacher.webOfScienceId||'')}`)}
        </div>
        <dl className="academic-metrics">
          <div><dt>Publicaciones</dt><dd>{activeTeacherMetrics.publicationsCount}</dd></div>
          <div><dt>Proyectos</dt><dd>{activeTeacherMetrics.projectsCount}</dd></div>
          <div><dt>Citas</dt><dd>{citationsAvailable ? activeTeacherMetrics.citationsTotal : 'No disponible'}</dd></div>
          <div className="academic-index-metric"><dt>Índices h externos</dt><dd><span>Google Scholar <strong>{activeTeacher.googleScholarHIndex??'—'}</strong></span><span>Scopus <strong>{activeTeacher.scopusHIndex??'—'}</strong></span></dd></div>
        </dl>
        <div className="academic-actions">
          <button className="primary-button" onClick={()=>onFilterInCatalog(activeTeacher.id)}>Ver publicaciones</button>
          <details className="academic-download"><summary><Download size={18} aria-hidden="true"/>Descargar perfil</summary><div>{(['pdf','xlsx','csv'] as const).map(format=><button key={format} onClick={e=>{handleTeacherExport(format);e.currentTarget.closest('details')?.removeAttribute('open');}}>{format==='pdf'?'CV · PDF':format==='xlsx'?'Excel':'CSV'}</button>)}</div></details>
        </div>
        <section className="academic-products" aria-label="Producción académica">
          <h4>Producción académica <span>({teacherProducts.length})</span></h4>
          {teacherProducts.length?teacherProducts.map(product=><button key={product.id} className="academic-product" onClick={()=>setViewingProduct(product)}><span className="academic-product-meta">{product.type==='publicacion'?'Publicación':'Proyecto'} · {productDateLabel(product)}</span><span className="academic-product-title">{product.title}</span><span className="academic-product-venue">{product.venue||product.fundingVenue||''}</span></button>):<p className="academic-empty">Este docente aún no tiene productos registrados.</p>}
        </section>
      </article>:<p className="academic-empty">No hay docentes registrados.</p>}
    </div>
    {viewingProduct&&<ProductDetailModal product={viewingProduct} onClose={()=>setViewingProduct(null)}/>}
  </section>;
};

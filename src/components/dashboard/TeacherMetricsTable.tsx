import React, { useState } from 'react';
import { TeacherMetrics } from '../../types';
import { Users, Search, ExternalLink, ChevronRight } from 'lucide-react';

interface TeacherMetricsTableProps {
  teacherMetrics: TeacherMetrics[];
  schoolCode?: string;
  onSelectTeacher: (teacherId: string) => void;
  onViewTeacherProducts: (teacherId: string) => void;
}

export const TeacherMetricsTable: React.FC<TeacherMetricsTableProps> = ({
  teacherMetrics,
  schoolCode = 'ECMC',
  onSelectTeacher,
  onViewTeacherProducts,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const importedProfiles = teacherMetrics.some(metric => metric.teacher.id.startsWith('ecmc-orcid-researcher-'));

  const filteredTeachers = teacherMetrics.filter((tm) => {
    const q = searchQuery.toLowerCase();
    return (
      tm.teacher.name.toLowerCase().includes(q) ||
      tm.teacher.email.toLowerCase().includes(q) ||
      tm.teacher.rank.toLowerCase().includes(q) ||
      (tm.teacher.academicDegree&&tm.teacher.academicDegree.toLowerCase().includes(q)) ||
      (tm.teacher.academicField&&tm.teacher.academicField.toLowerCase().includes(q)) ||
      (tm.teacher.orcid && tm.teacher.orcid.includes(q))
    );
  });

  return (
    <div className="overflow-hidden">
      {/* Encabezado y buscador */}
      <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="school-accent-icon p-1.5">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-neutral-900 tracking-tight">
              Directorio e Indicadores por Docente ({schoolCode})
            </h3>
            <p className="text-xs text-neutral-500">
              {importedProfiles ? 'Investigadores vinculados por ORCID, publicaciones y citas disponibles en la fuente importada.' : 'Publicaciones, proyectos, citas registradas e índices h reportados por plataformas externas.'}
            </p>
          </div>
        </div>

        {/* Input de búsqueda */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchDraft} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();setSearchQuery(searchDraft.trim());}}}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Buscar profesor..."
            className="school-accent-focus w-full pl-9 pr-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white"
          />
        </div>
      </div>

      {/* Tabla responsiva */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
              <th className="py-3 px-6">Docente Investigador</th>
              <th className="py-3 px-4">Identificador ORCID</th>
              <th className="py-3 px-4 text-center">Publicaciones</th>
              <th className="py-3 px-4 text-center">Proyectos</th>
              <th className="py-3 px-4 text-center">Citas Totales</th>
              <th className="py-3 px-4 text-center">Índices h externos</th>
              <th className="py-3 px-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-xs">
            {filteredTeachers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-400">
                  No se encontraron docentes con el término "{searchQuery}".
                </td>
              </tr>
            ) : (
              filteredTeachers.map((tm) => (
                <tr
                  key={tm.teacher.id}
                  className="hover:bg-neutral-50/70 transition-colors group"
                >
                  {/* Docente */}
                  <td className="py-4 px-6">
                    <button
                      onClick={() => onSelectTeacher(tm.teacher.id)}
                      className="teacher-name-action text-left transition-colors"
                    >
                      <div className="teacher-name-title font-bold text-neutral-900">
                        {tm.teacher.name}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {[tm.teacher.rank, tm.teacher.academicDegree ? `${tm.teacher.academicDegree}${tm.teacher.academicField ? ` en ${tm.teacher.academicField}` : ''}` : ''].filter(Boolean).join(' · ')}{(tm.teacher.rank || tm.teacher.academicDegree) && tm.teacher.email ? ' • ' : ''}{tm.teacher.email ? <span className="tabular-nums text-[10px]">{tm.teacher.email}</span> : tm.teacher.id.startsWith('ecmc-orcid-researcher-') ? 'Perfil importado de ORCID' : ''}
                      </div>
                    </button>
                  </td>

                  {/* ORCID */}
                  <td className="py-4 px-4 tabular-nums text-[11px]">
                    {tm.teacher.orcid ? (
                      <a
                        href={`https://orcid.org/${tm.teacher.orcid}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="teacher-orcid-link inline-flex items-center gap-1 px-2 py-0.5 rounded"
                      >
                        <span>{tm.teacher.orcid}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-neutral-400 text-xs">—</span>
                    )}
                  </td>

                  {/* Publicaciones */}
                  <td className="py-4 px-4 text-center font-semibold text-neutral-800 tabular-nums">
                    {tm.publicationsCount}
                  </td>

                  {/* Proyectos */}
                  <td className="py-4 px-4 text-center font-semibold text-neutral-800 tabular-nums">
                    {tm.projectsCount}
                  </td>

                  {/* Citas Totales */}
                  <td className="py-4 px-4 text-center font-bold text-neutral-900 tabular-nums">
                    {tm.citationsTotal}
                  </td>

                  {/* Índices h reportados por las plataformas externas */}
                  <td className="py-4 px-4 text-center font-semibold text-neutral-800 tabular-nums text-xs">
                    <span className="teacher-external-index">Scholar: {tm.teacher.googleScholarHIndex ?? '—'}</span>
                    <span className="teacher-external-index">Scopus: {tm.teacher.scopusHIndex ?? '—'}</span>
                  </td>

                  {/* Acciones */}
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => onViewTeacherProducts(tm.teacher.id)}
                      className="teacher-products-action inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 transition-colors"
                    >
                      <span>Ver Productos</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

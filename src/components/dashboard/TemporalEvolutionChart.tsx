import React, { useState } from 'react';
import { TemporalDataPoint } from '../../services/metricsService';
import { TrendingUp } from 'lucide-react';

interface TemporalEvolutionChartProps {
  data: TemporalDataPoint[];
}

type ChartSeriesMode = 'total' | 'publications' | 'projects';

export const TemporalEvolutionChart: React.FC<TemporalEvolutionChartProps> = ({ data }) => {
  const [seriesMode, setSeriesMode] = useState<ChartSeriesMode>('total');
  const [hoveredPoint, setHoveredPoint] = useState<TemporalDataPoint | null>(null);
  const annual = data.some(point => point.unit === 'year');
  const period = annual && data.length ? `${data[0].semester} - ${data[data.length - 1].semester}` : '2021 - 2026';
  const unit = annual ? 'año' : 'semestre';

  // Mantener una escala común para comparar publicaciones y proyectos.
  const maxValue = Math.max(
    ...data.map((d) => (seriesMode === 'total' ? d.total : seriesMode === 'publications' ? d.publications : d.projects)),
    4 // Mínimo 4 para evitar división por cero o barras desproporcionadas
  );

  return (
    <div className="research-chart-card research-semester-chart">
      {/* Encabezado del gráfico */}
      <div className="semester-chart-heading flex flex-col items-stretch justify-between gap-4 mb-6 pb-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="semester-chart-accent-icon p-1.5">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-neutral-900 tracking-tight">
              Evolución de la Producción Científica de la Escuela ({period})
            </h3>
            <p className="text-[11px] text-neutral-500">
              Publicaciones y proyectos por {unit}
            </p>
          </div>
        </div>

        {/* Alternador de Series (Segmented control) */}
        <div className="semester-mode-control flex items-center gap-1 p-1 self-start sm:self-auto text-xs font-semibold">
          <button
            type="button"
            aria-pressed={seriesMode === 'total'}
            onClick={() => setSeriesMode('total')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              seriesMode === 'total'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Total Productos
          </button>
          <button
            type="button"
            aria-pressed={seriesMode === 'publications'}
            onClick={() => setSeriesMode('publications')}
            className={`semester-mode-publications px-3 py-1.5 rounded-md transition-all ${
              seriesMode === 'publications'
                ? 'bg-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Solo Publicaciones
          </button>
          <button
            type="button"
            aria-pressed={seriesMode === 'projects'}
            onClick={() => setSeriesMode('projects')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              seriesMode === 'projects'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Solo Proyectos
          </button>
        </div>
      </div>

      {seriesMode === 'total' && (
        <div className="semester-chart-legend" aria-label="Leyenda del gráfico">
          <span><i className="semester-legend-publications" />Publicaciones</span>
          <span><i className="semester-legend-projects" />Proyectos</span>
        </div>
      )}

      {/* Área del gráfico de barras */}
      <div className="semester-chart-viewport relative pt-6 pb-2">
        {/* Tooltip flotante si hay hover */}
        {hoveredPoint && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-xs px-3 py-1.5 flex items-center gap-2 pointer-events-none z-20">
            <span className="font-bold">{hoveredPoint.semester}:</span>
            <span>
              {seriesMode === 'total' && `${hoveredPoint.total} productos (${hoveredPoint.publications} pub, ${hoveredPoint.projects} proy)`}
              {seriesMode === 'publications' && `${hoveredPoint.publications} publicaciones`}
              {seriesMode === 'projects' && `${hoveredPoint.projects} proyectos`}
            </span>
          </div>
        )}

        {/* Contenedor de barras */}
        <div className="semester-chart-scroll" role="region" aria-label={`Gráfica de producción por ${unit}`} tabIndex={0}>
          <div
            className="semester-chart-content"
            style={{ '--semester-chart-width': `${data.length * 48}px` } as React.CSSProperties}
          >
            <div className="semester-chart-plot h-56 flex items-end justify-between gap-1 sm:gap-2 px-2">
              {data.map((d) => {
                const val =
                  seriesMode === 'total'
                    ? d.total
                    : seriesMode === 'publications'
                    ? d.publications
                    : d.projects;

                // En el modo total, ambas series usan la escala común y se agrupan lado a lado.
                const heightPercent = val > 0 ? Math.max((val / maxValue) * 100, 8) : 0;
                const publicationsHeight = d.publications > 0 ? Math.max((d.publications / maxValue) * 100, 8) : 0;
                const projectsHeight = d.projects > 0 ? Math.max((d.projects / maxValue) * 100, 8) : 0;

                const isHovered = hoveredPoint?.semester === d.semester;

                return (
                  <div
                    key={d.semester}
                    onMouseEnter={() => setHoveredPoint(d)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    className="semester-chart-slot flex-1 min-w-0 flex flex-col items-center justify-end h-full group cursor-pointer"
                  >
                    {/* Valor arriba de la barra */}
                    <span
                      className={`semester-chart-value text-[11px] font-bold mb-1 transition-opacity tabular-nums ${
                        val > 0
                          ? isHovered ? 'is-highlighted' : 'text-neutral-600'
                          : 'text-neutral-300 opacity-60'
                      }`}
                    >
                      {val}
                    </span>

                    {/* Barras agrupadas para que cada serie se identifique sin superponerse. */}
                    {seriesMode === 'total' ? (
                      <div className="semester-chart-bars">
                        <div className="semester-chart-series-track" title={`${d.publications} publicaciones`}>
                          <div style={{ height: `${publicationsHeight}%` }} className={`semester-chart-series-bar semester-bar-publications ${isHovered ? 'is-hovered' : ''}`} />
                        </div>
                        <div className="semester-chart-series-track" title={`${d.projects} proyectos`}>
                          <div style={{ height: `${projectsHeight}%` }} className={`semester-chart-series-bar semester-bar-projects ${isHovered ? 'is-hovered' : ''}`} />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full max-w-[42px] relative flex items-end overflow-hidden h-full">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`semester-single-bar ${seriesMode === 'projects' ? 'project' : 'publication'} ${val === 0 ? 'is-empty' : ''} ${isHovered ? 'is-hovered' : ''}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Eje X con nombres de semestres */}
            <div className="semester-chart-axis flex items-center justify-between gap-1 sm:gap-2 px-2 pt-2">
              {data.map((d) => (
                <div
                  key={d.semester}
                  className="semester-chart-slot flex-1 min-w-0 text-center text-[10px] sm:text-[11px] font-medium text-neutral-500 truncate"
                  title={d.semester}
                >
                  {d.semester}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

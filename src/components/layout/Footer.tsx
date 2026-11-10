import React from 'react';
import { YachayLogo } from '../institutional/SchoolLogo';
import { ActiveTab } from './Header';
import { RotateCcw } from 'lucide-react';

interface FooterProps {
  onTabChange: (tab: ActiveTab) => void;
  onOpenReviewerConsole: () => void;
  onResetSeedData: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onTabChange,
  onOpenReviewerConsole,
  onResetSeedData,
}) => {
  return (
    <footer className="bg-neutral-900 text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Columna 1: Identidad Institucional */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <YachayLogo width={144} />
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  SIMAPC · Yachay Tech
                </h3>
                <p className="text-xs text-neutral-400">
                  Sistema de Información, Monitoreo y Administración de la Producción Científica
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">
              Plataforma de gestión, verificación y visibilización de la producción científica y
              proyectos de investigación para docentes de las escuelas de la Universidad Yachay Tech.
            </p>

            <p className="text-[11px] text-neutral-500">
              Universidad de Investigación de Tecnología Experimental Yachay Tech • Urcuquí, Imbabura,
              Ecuador.
            </p>
          </div>

          {/* Columna 2: Módulos del Sistema */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Módulos del Sistema
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <button
                  onClick={() => onTabChange('dashboard')}
                  className="hover:text-white transition-colors"
                >
                  Dashboard & Métricas de Impacto
                </button>
              </li>
              <li>
                <button
                  onClick={() => onTabChange('catalog')}
                  className="hover:text-white transition-colors"
                >
                  Catálogo de Producción Científica
                </button>
              </li>
              <li>
                <button
                  onClick={() => onTabChange('directory')}
                  className="hover:text-white transition-colors"
                >
                  Directorio de Investigadores
                </button>
              </li>
              <li>
                <button
                  onClick={() => onTabChange('traceability')}
                  className="hover:text-[var(--school-ink)] font-semibold transition-colors"
                >
                  Matriz de Trazabilidad Ágil (RF / HU)
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenReviewerConsole}
                  className="hover:text-emerald-400 font-semibold transition-colors"
                >
                  Comité Científico
                </button>
              </li>
            </ul>
          </div>

          {/* Columna 3: Escuela y restauración de datos */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Plataforma y Soporte
            </h4>
            <p className="text-xs text-neutral-400">
              Escuela de Ciencias Matemáticas y Computacionales (ECMC)
            </p>
            <p className="text-xs text-neutral-500">
              Universidad Yachay Tech • San Miguel de Urcuquí
            </p>

            <div className="pt-3">
              <button
                onClick={onResetSeedData}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[var(--school-ink)]" />
                Restaurar datos iniciales
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-4">
          <p>© {new Date().getFullYear()} Escuela de Ciencias Matemáticas y Computacionales - Yachay Tech. Todos los derechos reservados.</p>
          <p className="text-[11px] text-neutral-600">
            Fase I: Centralización y visualización académica (Art. 7 CES)
          </p>
        </div>
      </div>
    </footer>
  );
};

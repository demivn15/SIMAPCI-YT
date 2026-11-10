import React, { useState, useMemo } from 'react';
import { ScientificProduct, TeacherUser, FilterState, ProductType, OfficialResearchLine, ProductStatus } from '../../types';
import { ACADEMIC_SEMESTERS } from '../../constants/researchLines';
import { productService } from '../../services/productService';
import { productCitationValue } from '../../services/productPresentation';
import { exportService, ExportMetadata } from '../../services/exportService';
import { ProductCard } from './ProductCard';
import { ProductDetailModal } from './ProductDetailModal';
import { ProjectTrackingModal } from './ProjectTrackingModal';
import {
  Search,
  Download,
  Plus,
  Filter,
  X,
  FileSpreadsheet,
  FileText,
  Printer,
  ChevronDown,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';

interface CatalogViewProps {
  onlyMine?: boolean;
  allowRegister?: boolean;
  allProducts: ScientificProduct[];
  teachers: TeacherUser[];
  currentUserId: string | null;
  initialTeacherFilter?: string;
  onOpenRegister: () => void;
  onEditProduct?: (product: ScientificProduct) => void;
  onProjectUpdated?: (product: ScientificProduct) => void;
  researchLines: readonly OfficialResearchLine[];
  schoolName: string;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  onlyMine = false,
  allowRegister = true,
  allProducts,
  teachers,
  currentUserId,
  initialTeacherFilter,
  onOpenRegister,
  onEditProduct,
  onProjectUpdated,
  researchLines,
  schoolName,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<ScientificProduct | null>(null);
  const [trackingProject, setTrackingProject] = useState<ScientificProduct | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<'recent' | 'citations' | 'title'>('recent');

  // Estado de filtros
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    productType: 'todos',
    teacherId: initialTeacherFilter || 'todos',
    periodYear: 'todos',
    researchLine: 'todas',
    status: 'todos',
  });

  // Productos visibles según sesión
  const visibleProducts = useMemo(() => {
    const schoolProductIds = new Set(allProducts.map(product => product.id));
    const visible = productService.getVisibleProducts(currentUserId).filter(product => schoolProductIds.has(product.id));
    return onlyMine ? visible.filter(p=>p.ownerId===currentUserId) : visible;
  }, [allProducts, currentUserId, onlyMine]);

  const hasImportedCorpus = allProducts.some(product => !!product.bibliographicSource);
  const periodYears = useMemo(() => hasImportedCorpus
    ? [...new Set(allProducts.map(product => product.year))].filter(Number.isFinite).sort((a, b) => b - a)
    : [2026, 2025, 2024, 2023, 2022, 2021], [allProducts, hasImportedCorpus]);
  const periodSemesters = useMemo(() => hasImportedCorpus
    ? [...new Set(allProducts.flatMap(product => product.semester ? [product.semester] : []))].sort().reverse()
    : ACADEMIC_SEMESTERS, [allProducts, hasImportedCorpus]);

  // Aplicar filtros combinados
  const filteredProducts = useMemo(() => {
    let result = productService.filterProducts(visibleProducts, filters);

    // Ordenamiento
    if (sortOption === 'recent') {
      result = [...result].sort((a, b) => b.year - a.year || (b.semester||'').localeCompare(a.semester||''));
    } else if (sortOption === 'citations') {
      result = [...result].sort((a, b) => (productCitationValue(b) ?? -1) - (productCitationValue(a) ?? -1));
    } else if (sortOption === 'title') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [visibleProducts, filters, sortOption]);

  const hasActiveFilters =
    filters.searchQuery !== '' ||
    filters.productType !== 'todos' ||
    filters.teacherId !== 'todos' ||
    filters.periodYear !== 'todos' ||
    filters.researchLine !== 'todas';

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      productType: 'todos',
      teacherId: 'todos',
      periodYear: 'todos',
      researchLine: 'todas',
      status: 'todos',
    });
  };

  // Manejador de exportaciones (HU11)
  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setShowExportMenu(false);

    if (filteredProducts.length === 0) {
      setExportNotice('No hay productos que coincidan con los filtros actuales para exportar.');
      setTimeout(() => setExportNotice(null), 3500);
      return;
    }

    const meta: ExportMetadata = {
      filters,
      totalRecords: filteredProducts.length,
      generatedAt: new Date().toLocaleString('es-EC'),
      institution: 'Universidad Yachay Tech',
      school: schoolName,
    };

    let success = false;
    if (format === 'csv') {
      success = exportService.exportToCsv(filteredProducts, meta);
    } else if (format === 'xlsx') {
      success = exportService.exportToExcel(filteredProducts, meta);
    } else if (format === 'pdf') {
      success = await exportService.exportToPrintablePdf(filteredProducts, meta);
    }

    if (success) {
      setExportNotice(`Exportación en formato ${format.toUpperCase()} generada exitosamente (${filteredProducts.length} registros).`);
    } else {
      setExportNotice('Hubo un error al generar la exportación.');
    }
    setTimeout(() => setExportNotice(null), 3500);
  };

  return (
    <div className="catalog-view space-y-6">
      {/* 1. Encabezado del Catálogo (Captura 08) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 tracking-tight">
            {onlyMine ? 'Mis registros' : 'Publicaciones y proyectos'}
          </h2>
          <p className="text-xs text-neutral-500">
            {onlyMine ? 'Consulte sus trabajos y el estado de revisión.' : 'Encuentre la investigación de nuestra comunidad.'}
          </p>
        </div>

        {/* Acciones Superiores */}
        <div className="flex items-center gap-2">
          {/* Botón Descargar resultados con menú */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={showExportMenu}
              aria-controls="catalog-export-menu"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-neutral-300 hover:border-neutral-400 bg-white text-neutral-700 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span>Descargar resultados</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            {showExportMenu && (
              <div id="catalog-export-menu" className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-neutral-200 bg-white p-1.5 text-sm shadow-lg">
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left font-medium leading-5 text-neutral-700 hover:bg-neutral-50"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span className="min-w-0">Descargar como CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('xlsx')}
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left font-medium leading-5 text-neutral-700 hover:bg-neutral-50"
                >
                  <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="min-w-0">Descargar como Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left font-medium leading-5 text-neutral-700 hover:bg-neutral-50"
                >
                  <Printer className="mt-0.5 h-4 w-4 shrink-0 school-accent-text" />
                  <span className="min-w-0">Imprimir / Exportar PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Acceso al registro solo en Mis registros */}
          {onlyMine && allowRegister && <button
            onClick={onOpenRegister}
            className="school-accent-button flex items-center gap-1.5 px-4 py-2 text-white text-xs font-bold transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar</span>
          </button>}
        </div>
      </div>

      {/* Aviso de exportación si aplica */}
      {exportNotice && (
        <div className="p-3 bg-neutral-900 text-white text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <span>{exportNotice}</span>
          <button onClick={() => setExportNotice(null)} className="text-white/70 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Barra de Búsqueda y Pestañas Rápidas de Tipo */}
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Input de Búsqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => setFilters(current => ({ ...current, searchQuery: e.target.value }))}
              aria-label="Buscar publicaciones y proyectos" placeholder="Escriba un título, autor o revista"
              className="school-accent-focus w-full pl-10 pr-4 py-2.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50/50 focus:bg-white transition-colors"
            />
          </div>

          {/* Segmented control: Todos, Publicaciones, Proyectos */}
          <div className="flex items-center gap-1 p-1 shrink-0 text-xs font-semibold">
            <button
              type="button"
              aria-pressed={filters.productType === 'todos'}
              onClick={() => setFilters({ ...filters, productType: 'todos' })}
              className={`catalog-type-filter-button px-3 py-1.5 rounded-md transition-all ${
                filters.productType === 'todos'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Todos ({visibleProducts.length})
            </button>
            <button
              type="button"
              aria-pressed={filters.productType === 'publicacion'}
              onClick={() => setFilters({ ...filters, productType: 'publicacion' })}
              className={`catalog-type-filter-button px-3 py-1.5 rounded-md transition-all ${
                filters.productType === 'publicacion'
                  ? 'bg-white shadow-xs school-accent-text'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Publicaciones
            </button>
            <button
              type="button"
              aria-pressed={filters.productType === 'proyecto'}
              onClick={() => setFilters({ ...filters, productType: 'proyecto' })}
              className={`catalog-type-filter-button px-3 py-1.5 rounded-md transition-all ${
                filters.productType === 'proyecto'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Proyectos
            </button>
          </div>
        </div>

        <details className="catalog-filters"><summary><Filter size={19}/> Más filtros</summary>
        {/* 3. Fila de filtros para docente, periodo y línea de investigación */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 text-xs">
          {/* Filtro Docente */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
              Docente / Investigador
            </label>
            <select
              value={filters.teacherId}
              onChange={(e) => setFilters({ ...filters, teacherId: e.target.value })}
              className="school-accent-focus w-full px-2.5 py-2 rounded-lg border border-neutral-200 text-xs bg-white text-neutral-800"
            >
              <option value="todos">Todos los docentes</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Periodo */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
              Periodo / Año
            </label>
            <select
              value={filters.periodYear}
              onChange={(e) => setFilters({ ...filters, periodYear: e.target.value })}
              className="school-accent-focus w-full px-2.5 py-2 rounded-lg border border-neutral-200 text-xs bg-white text-neutral-800"
            >
              <option value="todos">Todos los años</option>
              {periodYears.map(year => <option key={year} value={String(year)}>{year}</option>)}
              {periodSemesters.length > 0 && <optgroup label="Por semestre específico">
                {periodSemesters.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </optgroup>}
            </select>
          </div>

          {/* Filtro Línea de Investigación (Las 6 oficiales) */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
              Línea de Investigación
            </label>
            <select
              value={filters.researchLine}
              onChange={(e) => setFilters({ ...filters, researchLine: e.target.value as any })}
              className="school-accent-focus w-full px-2.5 py-2 rounded-lg border border-neutral-200 text-xs bg-white text-neutral-800"
            >
              <option value="todas">Todas las áreas</option>
              {researchLines.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>

        </div>

        </details>
        {/* Chips de filtros activos y botón limpiar */}
        {hasActiveFilters && (
          <div className="pt-2 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-neutral-400 font-semibold uppercase">
                Filtros activos:
              </span>
              {filters.searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-neutral-700 text-[11px]">
                  Búsqueda: "{filters.searchQuery}"
                  <button onClick={() => setFilters(current => ({ ...current, searchQuery: '' }))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.productType !== 'todos' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-neutral-700 text-[11px]">
                  Tipo: {filters.productType}
                  <button onClick={() => setFilters({ ...filters, productType: 'todos' })}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.teacherId !== 'todos' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-neutral-700 text-[11px]">
                  Docente: {teachers.find((t) => t.id === filters.teacherId)?.name}
                  <button onClick={() => setFilters({ ...filters, teacherId: 'todos' })}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.researchLine !== 'todas' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-neutral-700 text-[11px]">
                  Línea: {filters.researchLine}
                  <button onClick={() => setFilters({ ...filters, researchLine: 'todas' })}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.periodYear !== 'todos' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-neutral-700 text-[11px]">
                  Periodo: {filters.periodYear}
                  <button onClick={() => setFilters({ ...filters, periodYear: 'todos' })}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              onClick={resetFilters}
              className="school-accent-text text-[11px] font-semibold hover:underline"
            >
              Limpiar todos los filtros
            </button>
          </div>
        )}
      </div>

      {/* 4. Contador de Resultados y Ordenamiento (Captura 08) */}
      <div className="catalog-results-toolbar flex items-center justify-between text-xs text-neutral-600 px-1">
        <div>
          Mostrando <strong className="text-neutral-900 tabular-nums">{filteredProducts.length}</strong>{' '}
          productos científicos
        </div>

        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Ordenar por:</span>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
            className="school-accent-focus py-1 px-2 rounded-lg border border-neutral-200 text-xs bg-white text-neutral-800"
          >
            <option value="recent">Más recientes (Año desc)</option>
            <option value="citations">Más citados</option>
            <option value="title">Título (A-Z)</option>
          </select>
        </div>
      </div>

      {/* 5. Catálogo en Rejilla de 2 Columnas (Captura 08) */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-neutral-400 mx-auto" />
          <h3 className="text-base font-bold text-neutral-900">
            No se encontraron productos con los criterios seleccionados
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            Ninguna publicación o proyecto coincide simultáneamente con todos los filtros activos.
            Prueba ajustando los términos de búsqueda o limpiando filtros.
          </p>
          <div className="pt-2">
            <button
              onClick={resetFilters}
              className="px-4 py-2 rounded-lg bg-neutral-900 text-white font-semibold text-xs hover:bg-black transition-colors"
            >
              Restablecer Filtros
            </button>
          </div>
        </div>
      ) : (
        <div className="product-list">
          {filteredProducts.map((product) => (
            <article className={`catalog-product-item ${onlyMine && product.type === 'proyecto' ? 'has-project-tracking' : ''}`} key={product.id}>
              <ProductCard
                product={product}
                showStatus={onlyMine}
                onEdit={onlyMine&&product.status==='rechazado'&&onEditProduct?()=>onEditProduct(product):undefined}
                onClick={() => setSelectedProduct(product)}
              />
              {onlyMine && product.type === 'proyecto' && <button type="button" className="project-tracking-open" onClick={() => setTrackingProject(product)}><ClipboardList size={17} aria-hidden="true"/><span>Seguimiento del proyecto</span><span className="project-tracking-count">{product.projectProgressReports?.length || 0} avances</span></button>}
            </article>
          ))}
        </div>
      )}

      {/* Modal de Detalle */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          showStatus={onlyMine}
          onEdit={onlyMine&&selectedProduct.status==='rechazado'&&onEditProduct?()=>{const product=selectedProduct;setSelectedProduct(null);onEditProduct(product);}:undefined}
          onClose={() => setSelectedProduct(null)}
        />
      )}
      {trackingProject && <ProjectTrackingModal product={trackingProject} onClose={() => setTrackingProject(null)} onUpdated={updated => { setTrackingProject(updated); onProjectUpdated?.(updated); }}/ >}
    </div>
  );
};

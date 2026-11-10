import * as XLSX from 'xlsx';
import { ScientificProduct, FilterState, TeacherUser, TeacherMetrics, PROJECT_STATUS_LABELS } from '../types';
import { SCHOOLS } from '../constants/schools';
import { productDateValue, productCitationValue, productCitationLabel, productStatusLabel } from './productPresentation';
import { openPrintableDocument } from './printDocument';
import bricolageFontUrl from '../assets/fonts/bricolage-grotesque-latin-wght-normal.woff2?url';
import sourceSansFontUrl from '../assets/fonts/source-sans-3-latin-wght-normal.woff2?url';

function doiForDisplay(product: ScientificProduct): string | undefined {
  return product.status === 'verificado' ? product.doi : undefined;
}

export interface ExportMetadata {
  filters: FilterState;
  totalRecords: number;
  generatedAt: string;
  institution: string;
  school: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character);
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export const exportService = {
  /**
   * Genera y descarga archivo CSV con codificación UTF-8 y BOM
   */
  exportToCsv(products: ScientificProduct[], meta: ExportMetadata, fileName = 'produccion_cientifica_ecmc.csv'): boolean {
    if (!products || products.length === 0) {
      return false;
    }

    const includeSource = products.some(product => product.bibliographicSource);
    const headers = [
      'ID Sistema',
      'Tipo de Producto',
      'Título',
      'Autores / Investigadores',
      'Año',
      'Fecha de publicación / inicio',
      'Línea de Investigación',
      'Estado Oficial',
      'Identificador (DOI / Código)',
      'Medio / Revista / Fondo',
      'Estado del proyecto',
      'Participantes del proyecto',
      'Duración del proyecto (meses)',
      'Productos esperados',
      'Citas Registradas',
      'Fecha Registro',
      ...(includeSource ? ['Fuente', 'Tipo en la fuente', 'Cuartil SJR', 'SJR Score', 'ORCID de investigadores vinculados', 'Método de asignación de línea'] : []),
    ];

    const rows = products.map((p) => [
      p.id,
      p.type === 'publicacion' ? 'Publicación Científica' : 'Proyecto de Investigación',
      p.title,
      p.authors.join('; '),
      p.year,
      productDateValue(p),
      p.researchLine,
      productStatusLabel(p),
      doiForDisplay(p) || p.projectCode || 'N/A',
      p.venue || p.fundingVenue || 'N/A',
      p.projectStatus ? PROJECT_STATUS_LABELS[p.projectStatus] : 'N/A',
      (p.projectParticipants || []).join('; '),
      p.projectDurationMonths ?? '',
      (p.expectedProducts || []).join('; '),
      productCitationValue(p),
      new Date(p.createdAt).toLocaleDateString('es-EC'),
      ...(includeSource ? [p.bibliographicSource?.dataset, p.bibliographicSource?.publicationType,
        p.bibliographicSource?.sjrQuartile, p.bibliographicSource?.sjrScore,
        p.bibliographicSource?.researcherOrcids.join('; '),
        p.bibliographicSource?.researchLineClassification ? 'Sugerencia temporal por diccionario de palabras clave' : 'Sin asignación automática'] : []),
    ].map(csvCell));

    // Encabezado de metadatos institucionales
    const metaHeader = [
      `# SIMAPC - Sistema de Información, Monitoreo y Administración de la Producción Científica`,
      `# ${meta.school} - ${meta.institution}`,
      `# Fecha de Generación: ${meta.generatedAt}`,
      `# Total Registros Exportados: ${meta.totalRecords}`,
      `# Filtros Aplicados: Tipo=${meta.filters.productType}; Línea=${meta.filters.researchLine}; Periodo=${meta.filters.periodYear}`,
    ].map(csvCell).join('\r\n') + '\r\n';

    const csvContent = '\uFEFF' + metaHeader + [headers.map(csvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  },

  /**
   * Genera y descarga un libro de trabajo auténtico de Excel (.xlsx)
   */
  exportToExcel(products: ScientificProduct[], meta: ExportMetadata, fileName = 'produccion_cientifica_ecmc.xlsx'): boolean {
    if (!products || products.length === 0) {
      return false;
    }

    const includeSource = products.some(product => product.bibliographicSource);
    const data = products.map((p) => ({
      'ID Sistema': p.id,
      'Tipo de Producto': p.type === 'publicacion' ? 'Publicación Científica' : 'Proyecto de Investigación',
      'Título': p.title,
      'Autores / Investigadores': p.authors.join('; '),
      'Año': p.year,
      'Fecha de publicación / inicio': productDateValue(p),
      'Línea de Investigación': p.researchLine,
      'Estado de verificación': productStatusLabel(p),
      'Identificador Digital / Código': doiForDisplay(p) || p.projectCode || 'N/A',
      'Medio de Difusión / Fondo': p.venue || p.fundingVenue || 'N/A',
      'Estado del proyecto': p.projectStatus ? PROJECT_STATUS_LABELS[p.projectStatus] : 'N/A',
      'Participantes del proyecto': (p.projectParticipants || []).join('; '),
      'Duración del proyecto (meses)': p.projectDurationMonths ?? '',
      'Productos esperados': (p.expectedProducts || []).join('; '),
      'Citas Indexadas': productCitationValue(p) ?? '',
      'Fecha Registro': new Date(p.createdAt).toLocaleDateString('es-EC'),
      ...(includeSource ? {
        'Fuente': p.bibliographicSource?.dataset || '',
        'Tipo en la fuente': p.bibliographicSource?.publicationType || '',
        'Cuartil SJR': p.bibliographicSource?.sjrQuartile || '',
        'SJR Score': p.bibliographicSource?.sjrScore ?? '',
        'ORCID de investigadores vinculados': p.bibliographicSource?.researcherOrcids.join('; ') || '',
        'Método de asignación de línea': p.bibliographicSource?.researchLineClassification ? 'Sugerencia temporal por diccionario de palabras clave' : 'Sin asignación automática',
      } : {}),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Ajuste de anchos de columna automáticos
    worksheet['!cols'] = [
      { wch: 12 }, // ID
      { wch: 22 }, // Tipo
      { wch: 55 }, // Título
      { wch: 40 }, // Autores
      { wch: 8 },  // Año
      { wch: 24 }, // Fecha
      { wch: 45 }, // Línea
      { wch: 14 }, // Estado
      { wch: 30 }, // Identificador
      { wch: 35 }, // Medio
      { wch: 18 }, // Estado del proyecto
      { wch: 40 }, // Participantes
      { wch: 22 }, // Duración
      { wch: 45 }, // Productos esperados
      { wch: 14 }, // Citas
      { wch: 15 }, // Fecha
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Producción Científica ECMC');

    // Hoja secundaria con metadatos de la consulta
    const metaData = [
      { Parámetro: 'Portal', Valor: 'SIMAPC' },
      { Parámetro: 'Escuela', Valor: meta.school },
      { Parámetro: 'Institución', Valor: meta.institution },
      { Parámetro: 'Fecha Generación', Valor: meta.generatedAt },
      { Parámetro: 'Registros Exportados', Valor: meta.totalRecords },
      { Parámetro: 'Filtro Tipo', Valor: meta.filters.productType },
      { Parámetro: 'Filtro Línea', Valor: meta.filters.researchLine },
      { Parámetro: 'Filtro Periodo', Valor: meta.filters.periodYear },
    ];
    const metaWorksheet = XLSX.utils.json_to_sheet(metaData);
    XLSX.utils.book_append_sheet(workbook, metaWorksheet, 'Metadatos de Consulta');

    XLSX.writeFile(workbook, fileName);
    return true;
  },

  /**
   * Genera vista imprimible o PDF del reporte filtrado
   */
  async exportToPrintablePdf(products: ScientificProduct[], meta: ExportMetadata): Promise<boolean> {
    if (!products || products.length === 0) {
      return false;
    }

    const schoolAccent = SCHOOLS.find(school => meta.school.includes(school.code) || meta.school === school.name)?.accent ?? '#252321';

    const tableRowsHtml = products
      .map(
        (p) => `
      <tr style="border-bottom: 1px solid #E5E7EB; font-size: 11px;">
        <td style="padding: 8px 6px; font-weight: bold; color: #111827;">${escapeHtml(p.id)}</td>
        <td style="padding: 8px 6px;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; background: ${
            p.type === 'publicacion' ? '#EFF6FF; color: #1D4ED8' : '#F0FDF4; color: #15803D'
          };">
            ${p.type === 'publicacion' ? 'Publicación' : 'Proyecto'}
          </span>
        </td>
        <td style="padding: 8px 6px; max-width: 320px;">
          <div style="font-weight: 600; color: #111827; margin-bottom: 2px;">${escapeHtml(p.title)}</div>
          <div style="color: #6B7280; font-size: 10px;">${escapeHtml(p.authors.join(', '))}</div>
          <div style="color: #9CA3AF; font-size: 9px; margin-top: 2px;">${escapeHtml(p.venue || p.fundingVenue || '')}</div>
          ${p.bibliographicSource ? `<div style="font-size: 9px; margin-top: 2px;">Fuente: ${escapeHtml(p.bibliographicSource.dataset)} · ${escapeHtml(p.bibliographicSource.publicationType)}${p.bibliographicSource.sjrQuartile ? ` · SJR ${escapeHtml(p.bibliographicSource.sjrQuartile)}` : ''}${p.bibliographicSource.researchLineClassification ? ` · Línea sugerida temporalmente por diccionario: ${escapeHtml(p.bibliographicSource.researchLineClassification.matchedKeywords.join(', '))}` : ''}</div>` : ''}
        </td>
        <td style="padding: 8px 6px; color: #374151; font-size: 10px;">${escapeHtml(p.researchLine)}</td>
        <td style="padding: 8px 6px; text-align: center; color: #374151;">${escapeHtml(productDateValue(p))}</td>
        <td style="padding: 8px 6px; font-family: monospace; font-size: 10px; color: #4B5563;">
          ${doiForDisplay(p) ? `DOI: ${escapeHtml(doiForDisplay(p))}` : p.projectCode ? `Cód: ${escapeHtml(p.projectCode)}` : '—'}
        </td>
        <td style="padding: 8px 6px; text-align: center;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; ${
            p.status === 'verificado'
              ? 'background: #ECFDF5; color: #047857;'
              : p.status === 'cargado'
              ? 'background: #FFFBEB; color: #B45309;'
              : 'background: #FEF2F2; color: #B91C1C;'
          }">
            ${escapeHtml(productStatusLabel(p).toUpperCase())}
          </span>
        </td>
        <td style="padding: 8px 6px; text-align: right; font-weight: bold; font-family: monospace;">${escapeHtml(productCitationLabel(p))}</td>
      </tr>
    `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Producción Científica - SIMAPC</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          @font-face { font-family: 'Bricolage Grotesque'; src: url('${bricolageFontUrl}') format('woff2'); font-style: normal; font-weight: 200 800; }
          @font-face { font-family: 'Source Sans 3'; src: url('${sourceSansFontUrl}') format('woff2'); font-style: normal; font-weight: 200 900; }
          :root { --school-accent: ${schoolAccent}; --school-ink: color-mix(in srgb, var(--school-accent) 46%, #252321); }
          body { font-family: 'Source Sans 3', sans-serif; color: #252321; margin: 0; padding: 20px; }
          h1, h2, h3 { font-family: 'Bricolage Grotesque', sans-serif; color: #252321; }
          .header { border-bottom: 1px solid var(--school-accent); padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand-title { font-size: 20px; font-weight: 800; color: #252321; margin: 0; line-height: 1; }
          .brand-subtitle { font-size: 11px; font-weight: 600; color: #4B5563; text-transform: uppercase; margin-top: 4px; }
          .meta-box { font-size: 10px; color: #6B7280; text-align: right; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #F9FAFB; padding: 8px 6px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #4B5563; border-bottom: 2px solid #E5E7EB; }
          .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #E5E7EB; font-size: 9px; color: #9CA3AF; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <div>
              <div class="brand-title">SIMAPC</div>
              <div class="brand-subtitle">${escapeHtml(meta.school)} · Universidad Yachay Tech</div>
            </div>
          </div>
          <div class="meta-box">
            <div><strong>${products.some(product => product.bibliographicSource) ? 'Reporte de Producción Científica · Importación ORCID' : 'Reporte Oficial de Producción Científica'}</strong></div>
            <div>Fecha: ${meta.generatedAt}</div>
            <div>Total Registros: ${meta.totalRecords}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 70px;">ID</th>
              <th style="width: 85px;">Tipo</th>
              <th>Título y Autores</th>
              <th style="width: 170px;">Línea de Investigación</th>
              <th style="width: 65px; text-align: center;">Periodo</th>
              <th style="width: 130px;">Identificador</th>
              <th style="width: 85px; text-align: center;">Estado</th>
              <th style="width: 50px; text-align: right;">Citas</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div>Universidad de Investigación de Tecnología Experimental Yachay Tech • San Miguel de Urcuquí, Imbabura, Ecuador</div>
          <div>Reporte generado desde SIMAPC${products.some(product => product.bibliographicSource) ? ' · El archivo contiene investigadores vinculados por ORCID; no incluye la autoría completa.' : ''}</div>
        </div>
      </body>
      </html>
    `;

    return openPrintableDocument(html);
  },

  async exportTeacherCv(teacher: TeacherUser, products: ScientificProduct[], metrics: TeacherMetrics, generatedAt: string): Promise<boolean> {
    const schoolAccent = SCHOOLS.find(school => teacher.school === school.code)?.accent ?? '#252321';
    const importedProfile = teacher.id.startsWith('ecmc-orcid-researcher-');

    const profileLink = (field: 'githubUrl' | 'googleScholarId' | 'scopusAuthorId' | 'webOfScienceId', label: string, href: string, identifier: string) => {
      if (!identifier) return '';
      if (teacher.syntheticAcademicProfileFields?.includes(field)) return `<span>${label}</span>`;
      return `<a href="${escapeHtml(href)}">${label} · ${escapeHtml(identifier)}</a>`;
    };
    const links = [
      teacher.orcid && `<a href="https://orcid.org/${escapeHtml(teacher.orcid)}">ORCID · ${escapeHtml(teacher.orcid)}</a>`,
      teacher.googleScholarId && profileLink('googleScholarId', 'Google Scholar', `https://scholar.google.com/citations?user=${encodeURIComponent(teacher.googleScholarId)}`, teacher.googleScholarId),
      teacher.scopusAuthorId && profileLink('scopusAuthorId', 'Scopus', `https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(teacher.scopusAuthorId)}`, teacher.scopusAuthorId),
      teacher.webOfScienceId && profileLink('webOfScienceId', 'Web of Science', `https://www.webofscience.com/wos/author/record/${encodeURIComponent(teacher.webOfScienceId)}`, teacher.webOfScienceId),
      teacher.githubUrl && profileLink('githubUrl', 'GitHub', teacher.githubUrl, teacher.githubUrl),
    ].filter(Boolean).join(' <span>·</span> ');
    const researchLines = teacher.researchLines?.length
      ? teacher.researchLines
      : teacher.researchLine ? [teacher.researchLine] : [];
    const researchAreasHtml = researchLines.length
      ? researchLines.map(line => `<p><strong>${escapeHtml(line)}</strong>${teacher.researchSublines?.[line]?.length ? `<br>${teacher.researchSublines[line]?.map(escapeHtml).join(' · ')}` : ''}</p>`).join('')
      : '<p>No registradas</p>';
    const externalIndex = (name: string, value?: number) => {
      const shownValue = value === undefined ? 'No disponible' : String(value);
      return `<p><strong>Índice h ${name}:</strong> ${shownValue}</p>`;
    };
    const productsHtml = products.length
      ? products.map((product) => `<article class="product">
          <div class="product-meta">${product.type === 'publicacion' ? 'Publicación científica' : 'Proyecto de investigación'} · ${escapeHtml(product.year)}${product.projectStatus ? ` · ${escapeHtml(PROJECT_STATUS_LABELS[product.projectStatus])}` : ''}</div>
          <h3>${escapeHtml(product.title)}</h3>
          <p class="authors">${escapeHtml((product.projectParticipants?.length ? product.projectParticipants : product.authors).join(' · '))}</p>
          <p>${escapeHtml(product.venue || product.fundingVenue || product.researchLine)}${product.volumeIssue ? ` · ${escapeHtml(product.volumeIssue)}` : ''}</p>
          <p class="product-meta">${escapeHtml(productDateValue(product))}${doiForDisplay(product) ? ` · DOI: ${escapeHtml(doiForDisplay(product)!)}` : product.projectCode ? ` · Código: ${escapeHtml(product.projectCode)}` : ''}</p>
          ${product.type === 'proyecto' && product.expectedProducts?.length ? `<p><strong>Productos esperados:</strong> ${escapeHtml(product.expectedProducts.join(' · '))}</p>` : ''}
        </article>`).join('')
      : '<p>No hay producción verificada registrada en el portal.</p>';

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>CV · ${escapeHtml(teacher.name)}</title>
      <style>
        @font-face{font-family:'Bricolage Grotesque';src:url('${bricolageFontUrl}') format('woff2');font-style:normal;font-weight:200 800}
        @font-face{font-family:'Source Sans 3';src:url('${sourceSansFontUrl}') format('woff2');font-style:normal;font-weight:200 900}
        :root{--school-accent:${schoolAccent};--school-ink:color-mix(in srgb,var(--school-accent) 46%,#252321)}
        @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:'Source Sans 3',sans-serif;color:#252321;line-height:1.45;margin:0;font-size:10.5pt}
        h1,h2,h3{font-family:'Bricolage Grotesque',sans-serif;color:#252321}
        header{border-bottom:1px solid var(--school-accent);padding-bottom:14px;margin-bottom:22px}h1{font-size:25pt;line-height:1.15;margin:0 0 5px}header p{margin:3px 0;color:#645d56}
        .eyebrow{font-size:9pt;font-weight:bold;letter-spacing:1.4px;color:var(--school-ink);margin:0 0 6px}
        h2{font-size:13pt;letter-spacing:-.015em;border-bottom:1px solid #ded7ce;padding-bottom:5px;margin:19px 0 8px}
        h3{font-size:11pt;margin:3px 0}.facts{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px}.facts p{margin:2px 0}.muted,.product-meta{color:#6a625b;font-size:9pt}.links{font-size:9pt}.links a{color:#8b2a23;text-decoration:none}.product{padding:8px 0;border-bottom:1px solid #e5dfd8;break-inside:avoid}.product p{margin:2px 0}.authors{font-weight:600}.bio{white-space:pre-wrap}.footer{margin-top:24px;padding-top:8px;border-top:1px solid #ded7ce;color:#777;font-size:8pt;display:flex;justify-content:space-between}
        @media print{a{color:inherit}}
      </style></head><body>
      <header><p class="eyebrow">${importedProfile ? 'Perfil bibliográfico' : 'Currículum académico'} · SIMAPC</p><h1>${escapeHtml(teacher.name)}</h1>
        ${teacher.rank || teacher.academicDegree ? `<p>${escapeHtml(teacher.rank)}${teacher.academicDegree ? ` · ${escapeHtml(teacher.academicDegree)}${teacher.academicField ? ` en ${escapeHtml(teacher.academicField)}` : ''}` : ''}</p>` : ''}
        <p>${importedProfile ? 'Fuente: emcc_orcid.sql' : `${escapeHtml(teacher.email)} · Universidad Yachay Tech${teacher.yachayEntryYear ? ` · Docente desde ${escapeHtml(teacher.yachayEntryYear)}` : ''}`}</p></header>
      ${importedProfile ? '<p class="muted">El archivo no incluye formación, afiliación ni autoría completa. Los investigadores vinculados corresponden a las asociaciones ORCID de la fuente.</p>' : ''}
      <section><h2>Perfil profesional</h2><p class="bio">${escapeHtml(teacher.bio || (importedProfile ? 'No consta en el archivo importado.' : 'Perfil académico del personal investigador de la Universidad Yachay Tech.'))}</p></section>
      <section><h2>Áreas de investigación</h2>${researchAreasHtml}</section>
      <section><h2>Indicadores de producción</h2><div class="facts"><p><strong>Publicaciones verificadas:</strong> ${metrics.publicationsCount}</p><p><strong>Proyectos verificados:</strong> ${metrics.projectsCount}</p><p><strong>Citas registradas:</strong> ${metrics.citationsTotal}</p>${externalIndex('Google Scholar', teacher.googleScholarHIndex)}${externalIndex('Scopus', teacher.scopusHIndex)}</div></section>
      <section><h2>Identificadores y perfiles académicos</h2><p class="links">${links || 'No registrados'}</p></section>
      <section><h2>Producción académica verificada (${products.length})</h2>${productsHtml}</section>
      <div class="footer"><span>Universidad Yachay Tech · SIMAPC</span><span>Generado ${escapeHtml(generatedAt)}</span></div>
      </body></html>`;

    return openPrintableDocument(html);
  },
};

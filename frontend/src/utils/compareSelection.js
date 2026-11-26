/**
 * Selección de profesores de «Comparar docentes» en la URL (`?ids=a,b`), validada al leerla:
 * identificadores con forma válida, sin repetidos y como máximo cuatro.
 */
export const MAX_COMPARE = 4;
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export function readCompareIds(searchParams) {
  const ids = [];
  for (const raw of (searchParams.get('ids') || '').split(',')) {
    const id = raw.trim();
    if (ID_PATTERN.test(id) && !ids.includes(id)) ids.push(id);
    if (ids.length === MAX_COMPARE) break;
  }
  return ids;
}

export function writeCompareIds(searchParams, ids) {
  const params = new URLSearchParams(searchParams);
  const clean = [...new Set(ids)].filter((id) => ID_PATTERN.test(id)).slice(0, MAX_COMPARE);
  if (clean.length) params.set('ids', clean.join(','));
  else params.delete('ids');
  return params;
}

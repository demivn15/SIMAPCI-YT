/**
 * Grafos de fondo por escuela (SIMAPC).
 *
 * Cada escuela tiene un grafo de exactamente N_NODES nodos con una forma que
 * representa su campo. Como todos tienen el mismo número de nodos, el fondo es
 * UN SOLO grafo que se transforma de una escuela a otra (los nodos viajan) en
 * lugar de cambiar una imagen por otra.
 *
 * Todo es determinista (sin Math.random): el mismo resultado en cada carga.
 * Coordenadas en un lienzo de 1600 x 900.
 */

export type SchoolCode = 'ECAA' | 'ECBI' | 'ECFN' | 'ECTEA' | 'ECMC' | 'ECQI' | 'YTLC';

export const N_NODES = 72;

export interface SchoolGraph {
  /**
   * x0,y0,x1,y1,... (N_NODES pares) en coordenadas NORMALIZADAS: centradas en
   * (0,0) y escaladas para que la dimensión mayor mida de -1 a 1. El componente
   * las coloca en píxeles según el tamaño de la pantalla y la posición de la mascota.
   */
  points: Float32Array;
  /** pares de índices de nodo: a0,b0,a1,b1,... */
  edges: Uint16Array;
  /** semiancho y semialto normalizados (el mayor vale 1) */
  halfW: number;
  halfH: number;
}

/** Color del logo de cada escuela (se usa para trazo y nodos). */
export const SCHOOL_GRAPH_COLORS: Record<SchoolCode, string> = {
  ECAA: '#1db5a5',
  ECBI: '#6fb23a',
  ECFN: '#c4901a',
  ECTEA: '#d9743a',
  ECMC: '#e0453a',
  ECQI: '#3a9fd6',
  YTLC: '#1e9bb0',
};

// ---------- utilidades ----------
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];
type Edge = [number, number];

/**
 * Centra la nube en (0,0), la normaliza y ORDENA los nodos de izquierda a
 * derecha para que al transformarse entre escuelas los nodos hagan trayectos
 * cortos y coherentes.
 */
function finalize(pts: Pt[], edges: Edge[]): SchoolGraph {
  if (pts.length !== N_NODES) throw new Error(`grafo con ${pts.length} nodos, se esperaban ${N_NODES}`);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY) / 2;
  const norm: Pt[] = pts.map(([x, y]) => [(x - cx) / half, (y - cy) / half]);

  const order = norm.map((_, i) => i).sort((a, b) => norm[a][0] - norm[b][0] || norm[a][1] - norm[b][1]);
  const remap = new Array<number>(N_NODES);
  order.forEach((old, ni) => (remap[old] = ni));

  const points = new Float32Array(N_NODES * 2);
  order.forEach((old, ni) => {
    points[ni * 2] = norm[old][0];
    points[ni * 2 + 1] = norm[old][1];
  });
  const seen = new Set<string>();
  const out: number[] = [];
  for (const [a, b] of edges) {
    const A = remap[a], B = remap[b];
    if (A === B) continue;
    const key = A < B ? `${A}-${B}` : `${B}-${A}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(A, B);
  }
  return {
    points,
    edges: Uint16Array.from(out),
    halfW: (maxX - minX) / 2 / half,
    halfH: (maxY - minY) / 2 / half,
  };
}

// ---------- ECAA: árbol que crece (cultivo, cadena agroindustrial) ----------
function treeGraph(): SchoolGraph {
  const r = rng(11);
  const pts: Pt[] = [[0, 0]];
  const edges: Edge[] = [];
  // cola de ramas: [índice del nodo, ángulo, longitud, profundidad]
  const queue: [number, number, number, number][] = [[0, -Math.PI / 2, 150, 0]];
  while (pts.length < N_NODES && queue.length) {
    const [idx, ang, len, d] = queue.shift()!;
    const [px, py] = pts[idx];
    const kids = d === 0 ? 1 : d < 5 ? 2 : r() < 0.35 ? 1 : 2;
    for (let c = 0; c < kids && pts.length < N_NODES; c++) {
      const spread = kids === 1 ? (r() - 0.5) * 0.3 : (c === 0 ? -1 : 1) * (0.38 + r() * 0.22);
      const a = ang + spread;
      const l = len * (0.78 + r() * 0.1);
      const n = pts.length;
      pts.push([px + Math.cos(a) * l, py + Math.sin(a) * l]);
      edges.push([idx, n]);
      queue.push([n, a, l, d + 1]);
    }
  }
  return finalize(pts, edges);
}

// ---------- ECBI: doble hélice de ADN ----------
function helixGraph(): SchoolGraph {
  const pts: Pt[] = [];
  const edges: Edge[] = [];
  const per = N_NODES / 2; // 36 por hebra
  const turns = 3.2;
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < per; i++) {
      const t = i / (per - 1);
      const phase = t * turns * Math.PI * 2 + s * Math.PI;
      const along = t * 1000; // eje largo
      const across = Math.sin(phase) * 150;
      // eje inclinado ~ -28° para dinamismo
      const ang = -0.49;
      pts.push([along * Math.cos(ang) - across * Math.sin(ang), along * Math.sin(ang) + across * Math.cos(ang)]);
      if (i > 0) edges.push([s * per + i - 1, s * per + i]);
    }
  }
  for (let i = 0; i < per; i += 1) edges.push([i, per + i]); // peldaños
  return finalize(pts, edges);
}

// ---------- ECFN: átomo / órbitas (física y nanotecnología) ----------
function atomGraph(): SchoolGraph {
  const pts: Pt[] = [];
  const edges: Edge[] = [];
  // núcleo: 8 nodos en dos capas
  const nuc: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const rr = i % 2 ? 26 : 54;
    nuc.push(pts.length);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  for (let i = 0; i < 8; i++) edges.push([nuc[i], nuc[(i + 1) % 8]]);
  for (let i = 0; i < 8; i += 2) edges.push([nuc[i], nuc[(i + 2) % 8]]);
  // 4 órbitas de 16 nodos
  const orbitAngles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];
  for (let o = 0; o < 4; o++) {
    const first = pts.length;
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      const x = Math.cos(t) * 430;
      const y = Math.sin(t) * 150;
      const c = Math.cos(orbitAngles[o]), s = Math.sin(orbitAngles[o]);
      pts.push([x * c - y * s, x * s + y * c]);
      edges.push([first + i, first + ((i + 1) % 16)]);
    }
    edges.push([first + (o * 4) % 16, nuc[(o * 2) % 8]]); // la órbita toca el núcleo
  }
  return finalize(pts, edges);
}

// ---------- ECTEA: relieve (malla de terreno con montañas) ----------
function terrainGraph(): SchoolGraph {
  const r = rng(41);
  const pts: Pt[] = [];
  const edges: Edge[] = [];
  const cols = 12, rows = 6;
  const id = (c: number, row: number) => row * cols + c;
  const peaks = [
    { m: 0.28, a: 1.0, s: 0.09 },
    { m: 0.58, a: 1.45, s: 0.11 },
    { m: 0.86, a: 0.8, s: 0.07 },
  ];
  for (let row = 0; row < rows; row++) {
    const depth = row / (rows - 1); // 0 = fondo, 1 = frente
    const width = 520 + depth * 480; // perspectiva
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      let h = 0;
      for (const p of peaks) h += p.a * Math.exp(-((u - p.m) ** 2) / (2 * p.s * p.s));
      const elev = h * (170 + depth * 90) + (r() - 0.5) * 16;
      pts.push([(u - 0.5) * width, depth * 360 - elev]);
      if (c > 0) edges.push([id(c - 1, row), id(c, row)]);
      if (row > 0) {
        edges.push([id(c, row - 1), id(c, row)]);
        if (c > 0) edges.push([id(c - 1, row - 1), id(c, row)]);
      }
    }
  }
  return finalize(pts, edges);
}

// ---------- ECMC: red neuronal ----------
function neuralGraph(): SchoolGraph {
  const layers = [8, 12, 14, 16, 14, 8]; // = 72 nodos
  const pts: Pt[] = [];
  const edges: Edge[] = [];
  const start: number[] = [];
  layers.forEach((n, li) => {
    start.push(pts.length);
    for (let j = 0; j < n; j++) pts.push([li * 160, (j - (n - 1) / 2) * 42]);
  });
  for (let li = 0; li < layers.length - 1; li++) {
    const n = layers[li], m = layers[li + 1];
    for (let j = 0; j < n; j++) {
      const y = n === 1 ? 0.5 : j / (n - 1);
      const near = Array.from({ length: m }, (_, k) => k)
        .sort((a, b) => Math.abs(a / (m - 1) - y) - Math.abs(b / (m - 1) - y))
        .slice(0, 3);
      for (const k of near) edges.push([start[li] + j, start[li + 1] + k]);
    }
    // cada nodo de la capa siguiente recibe al menos una conexión
    for (let k = 0; k < m; k++) {
      const y = k / (m - 1);
      const j = Math.round(y * (n - 1));
      edges.push([start[li] + j, start[li + 1] + k]);
    }
  }
  return finalize(pts, edges);
}

// ---------- ECQI: molécula aromática (escama de anillos de seis + sustituyentes) ----------
function moleculeGraph(): SchoolGraph {
  const key = (x: number, y: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
  const idx = new Map<string, number>();
  const pts: Pt[] = [];
  const edges: Edge[] = [];
  const vert = (x: number, y: number) => {
    const k = key(x, y);
    let i = idx.get(k);
    if (i === undefined) { i = pts.length; idx.set(k, i); pts.push([x, y]); }
    return i;
  };
  const R = 2; // 19 anillos
  for (let q = -R; q <= R; q++) {
    for (let r = -R; r <= R; r++) {
      if (Math.abs(q + r) > R) continue;
      const cx = Math.sqrt(3) * (q + r / 2) * 60;
      const cy = 1.5 * r * 60;
      const ring: number[] = [];
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 180) * (30 + 60 * k);
        ring.push(vert(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60));
      }
      for (let k = 0; k < 6; k++) edges.push([ring[k], ring[(k + 1) % 6]]);
    }
  }
  // grado de cada vértice
  const deg = new Array(pts.length).fill(0);
  for (const [a, b] of edges) { deg[a]++; deg[b]++; }
  const outer = pts.map((_, i) => i).filter((i) => deg[i] === 2);
  outer.sort((a, b) => Math.atan2(pts[a][1], pts[a][0]) - Math.atan2(pts[b][1], pts[b][0]));
  const need = N_NODES - pts.length;
  for (let n = 0; n < need; n++) {
    const v = outer[Math.floor((n * outer.length) / need)];
    const [x, y] = pts[v];
    const d = Math.hypot(x, y) || 1;
    const id = pts.length;
    pts.push([x + (x / d) * 55, y + (y / d) * 55]);
    edges.push([v, id]);
  }
  return finalize(pts, edges);
}

// ---------- YTLC: globo (idiomas y cultura en red) ----------
function globeGraph(): SchoolGraph {
  const pts: Pt[] = [];
  const edges: Edge[] = [];
  const meridians = 8;
  const parallels = 9;
  const tilt = 0.45;
  const spin = 0.35;
  const id = (m: number, p: number) => m * parallels + p;
  for (let m = 0; m < meridians; m++) {
    for (let p = 0; p < parallels; p++) {
      const lon = (m / meridians) * Math.PI * 2 + spin;
      const lat = -Math.PI / 2 + ((p + 0.5) / parallels) * Math.PI;
      const x = Math.cos(lat) * Math.sin(lon);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.cos(lon);
      // inclinación del eje
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
      pts.push([x * 420, y2 * 420]);
      if (p > 0) edges.push([id(m, p - 1), id(m, p)]);
      edges.push([id(m, p), id((m + 1) % meridians, p)]);
    }
  }
  return finalize(pts, edges);
}

let cache: Record<SchoolCode, SchoolGraph> | null = null;
export function getSchoolGraphs(): Record<SchoolCode, SchoolGraph> {
  if (!cache) {
    cache = {
      ECAA: treeGraph(),
      ECBI: helixGraph(),
      ECFN: atomGraph(),
      ECTEA: terrainGraph(),
      ECMC: neuralGraph(),
      ECQI: moleculeGraph(),
      YTLC: globeGraph(),
    };
  }
  return cache;
}

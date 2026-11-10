import React from 'react';

/**
 * Fondos decorativos del carrusel de publicaciones destacadas.
 *
 * - Un fondo por línea de investigación; se elige con el mismo `theme` que ya
 *   se publica en `data-theme` de la tarjeta.
 * - Solo trazos geométricos: nunca letras, cifras ni metadatos. Todo el texto
 *   visible sigue siendo texto real del componente.
 * - La opacidad, el desvanecido hacia el texto y el tamaño se controlan desde
 *   CSS (`.featured-paper-backdrop`) y el SVG es `aria-hidden`.
 */
export type ResearchTheme =
  | 'mathematics'
  | 'data'
  | 'computing'
  | 'artificial-intelligence'
  | 'technology'
  | 'society';

const W = 1200;
const H = 420;

// Paleta institucional ya usada en el proyecto.
const RED = 'var(--accent)';
const WARM = '#b58a70';
const INK = '#625853';

/* ---------- utilidades deterministas (sin Math.random: el trazo no cambia entre renders) ---------- */

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (v: number) => Math.round(v * 10) / 10;
const poly = (points: [number, number][], close = false) =>
  `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}${close ? 'Z' : ''}`;

/** Curva de nivel: elipse deformada, como una isolínea de una superficie. */
function contour(cx: number, cy: number, r: number, squash: number, phase: number, wobble: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const k = 1 + wobble * Math.sin(2 * a + phase) + wobble * 0.55 * Math.sin(3 * a + phase * 1.7);
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * squash]);
  }
  return poly(pts, true);
}

function arrowHead(x: number, y: number, dir: 'right' | 'up') {
  return dir === 'right'
    ? `M${x - 9} ${y - 5}L${x} ${y}L${x - 9} ${y + 5}`
    : `M${x - 5} ${y + 9}L${x} ${y}L${x + 5} ${y + 9}`;
}

/** Evita repetir los atributos comunes del trazo. */
const S = {
  fill: 'none',
  strokeWidth: 1.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/* ---------- 1. Ecuaciones diferenciales, análisis, modelamiento y optimización ---------- */

function MathematicsBackdrop() {
  const levels = [34, 64, 96, 130, 166, 204].map((r, i) => contour(985, 190, r, 0.74, i * 0.45, 0.07));
  const minor = [22, 46, 72].map((r, i) => contour(1110, 330, r, 0.8, 1.2 + i * 0.5, 0.09));

  const xTicks = Array.from({ length: 13 }, (_, i) => 580 + i * 48);
  const yTicks = Array.from({ length: 8 }, (_, i) => 70 + i * 44);

  const sine: [number, number][] = [];
  for (let x = 580; x <= 1176; x += 6) sine.push([x, 352 - 58 * Math.sin((x - 580) / 52)]);

  // Campo de pendientes (ecuación diferencial): segmentos cortos orientados.
  const field: string[] = [];
  for (let x = 70; x < 560; x += 50) {
    for (let y = 40; y < 400; y += 46) {
      const a = Math.atan(Math.sin(x / 85) * Math.cos(y / 66) * 1.4);
      const dx = Math.cos(a) * 9;
      const dy = Math.sin(a) * 9;
      field.push(`M${f(x - dx)} ${f(y - dy)}L${f(x + dx)} ${f(y + dy)}`);
    }
  }

  return (
    <>
      <g stroke={RED} {...S} opacity={0.9}>
        {levels.map((d, i) => <path key={i} d={d} opacity={0.55 + (i % 3) * 0.15} />)}
      </g>
      <g stroke={WARM} {...S}>
        {minor.map((d, i) => <path key={i} d={d} />)}
      </g>
      <g stroke={INK} {...S} opacity={0.85}>
        <path d={`M580 352H1180${arrowHead(1180, 352, 'right')}`} />
        <path d={`M640 404V36${arrowHead(640, 36, 'up')}`} />
        {xTicks.map((x) => <path key={x} d={`M${x} 346V358`} />)}
        {yTicks.map((y) => <path key={y} d={`M634 ${y}H646`} />)}
      </g>
      <path d={poly(sine)} stroke={RED} {...S} strokeWidth={1.6} />
      <path d="M690 330L1010 212" stroke={INK} {...S} strokeDasharray="6 7" />
      <circle cx={850} cy={271} r={4.5} fill={RED} stroke="none" />
      <path d={field.join('')} stroke={WARM} {...S} />
    </>
  );
}

/* ---------- 2. Ciencia de datos ---------- */

function DataBackdrop() {
  const rand = rng(7);

  // Retícula de puntos con tamaños variables.
  const dots: { x: number; y: number; r: number; o: number; hot: boolean }[] = [];
  for (let x = 596; x <= 1180; x += 28) {
    for (let y = 26; y <= 400; y += 28) {
      const v = rand();
      dots.push({ x, y, r: v > 0.93 ? 3.4 : 1.5 + v * 1.1, o: 0.35 + rand() * 0.5, hot: v > 0.93 });
    }
  }

  // Matrices de datos (celdas llenas, parciales y vacías).
  const matrix = (ox: number, oy: number, cols: number, rows: number, seed: number) => {
    const r = rng(seed);
    const cells: React.ReactElement[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const v = r();
        cells.push(
          <rect
            key={`${ox}-${i}-${j}`}
            x={ox + i * 26}
            y={oy + j * 26}
            width={20}
            height={20}
            rx={3}
            fill={v > 0.4 ? RED : 'none'}
            fillOpacity={v > 0.4 ? 0.18 + v * 0.5 : 0}
            stroke={v > 0.4 ? 'none' : INK}
          />,
        );
      }
    }
    return cells;
  };

  // Nube de puntos con conexiones discretas entre vecinos próximos.
  const pts: [number, number][] = Array.from({ length: 16 }, (_, i) => {
    const a = rand() * Math.PI * 2;
    const d = 20 + rand() * 120;
    return [880 + Math.cos(a) * d * 1.3 + i * 4, 260 + Math.sin(a) * d * 0.55] as [number, number];
  });
  const edges: string[] = [];
  pts.forEach((p, i) => {
    const near = pts
      .map((q, j) => ({ j, d: Math.hypot(p[0] - q[0], p[1] - q[1]) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    near.forEach((o) => {
      if (o.j > i) edges.push(`M${f(p[0])} ${f(p[1])}L${f(pts[o.j][0])} ${f(pts[o.j][1])}`);
    });
  });

  return (
    <>
      <g stroke="none">
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.hot ? RED : INK} opacity={d.hot ? 0.9 : d.o * 0.55} />
        ))}
      </g>
      <g {...S}>{matrix(752, 50, 6, 5, 21)}</g>
      <g {...S}>{matrix(1000, 290, 6, 4, 55)}</g>
      <path d={edges.join('')} stroke={INK} {...S} />
      <g fill={WARM} stroke={RED} strokeWidth={1.2}>
        {pts.map(([x, y], i) => <circle key={i} cx={f(x)} cy={f(y)} r={4.2} />)}
      </g>
      <path d="M690 392L1130 150" stroke={RED} {...S} strokeDasharray="5 8" />
    </>
  );
}

/* ---------- 3. Computación científica ---------- */

function ComputingBackdrop() {
  const disp = (x: number, y: number): [number, number] => [
    x + 14 * Math.sin(y / 62 + x / 150),
    y + 14 * Math.cos(x / 74 + y / 130),
  ];

  const cols = 15;
  const rows = 9;
  const x0 = 540;
  const y0 = 22;
  const dx = 46;
  const dy = 48;

  const verticals: string[] = [];
  for (let i = 0; i < cols; i++) {
    const line: [number, number][] = [];
    for (let y = y0 - 10; y <= y0 + rows * dy; y += 12) line.push(disp(x0 + i * dx, y));
    verticals.push(poly(line));
  }
  const horizontals: string[] = [];
  for (let j = 0; j <= rows; j++) {
    const line: [number, number][] = [];
    for (let x = x0; x <= x0 + (cols - 1) * dx; x += 12) line.push(disp(x, y0 + j * dy));
    horizontals.push(poly(line));
  }

  // Triangulación (diagonales) alrededor de una zona de refinamiento.
  const hole = { x: 905, y: 212 };
  const diagonals: string[] = [];
  const nodes: React.ReactElement[] = [];
  for (let i = 0; i < cols - 1; i++) {
    for (let j = 0; j < rows; j++) {
      const cx = x0 + (i + 0.5) * dx;
      const cy = y0 + (j + 0.5) * dy;
      if (Math.hypot(cx - hole.x, cy - hole.y) < 150) {
        const a = disp(x0 + i * dx, y0 + j * dy);
        const b = disp(x0 + (i + 1) * dx, y0 + (j + 1) * dy);
        diagonals.push(`M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`);
        nodes.push(<circle key={`${i}-${j}`} cx={f(a[0])} cy={f(a[1])} r={2.4} />);
      }
    }
  }

  // Polígono triangulado en abanico (geometría computacional).
  const polygon: [number, number][] = [[1040, 286], [1100, 270], [1160, 306], [1148, 372], [1086, 396], [1030, 350]];
  const fan = polygon.slice(2, -1).map((p) => `M${polygon[0][0]} ${polygon[0][1]}L${p[0]} ${p[1]}`).join('');

  return (
    <>
      <g stroke={WARM} {...S}>
        {verticals.map((d, i) => <path key={`v${i}`} d={d} />)}
        {horizontals.map((d, i) => <path key={`h${i}`} d={d} />)}
      </g>
      <path d={diagonals.join('')} stroke={RED} {...S} opacity={0.85} />
      <g fill={RED} stroke="none">{nodes}</g>
      <circle cx={hole.x} cy={hole.y} r={64} stroke={RED} {...S} strokeWidth={1.5} strokeDasharray="4 6" />
      <g stroke={INK} {...S}>
        <path d={poly(polygon, true)} />
        <path d={fan} />
      </g>
      <g fill="#fffdfa" stroke={INK} strokeWidth={1.2}>
        {polygon.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.6} />)}
      </g>
    </>
  );
}

/* ---------- 4. Inteligencia artificial ---------- */

function ArtificialIntelligenceBackdrop() {
  const rand = rng(19);
  const layers = [
    { x: 745, n: 4 },
    { x: 842, n: 6 },
    { x: 940, n: 6 },
    { x: 1040, n: 5 },
    { x: 1140, n: 3 },
  ];
  const place = (n: number): number[] => Array.from({ length: n }, (_, i) => 210 + (i - (n - 1) / 2) * 56);

  const links: string[] = [];
  layers.slice(0, -1).forEach((l, li) => {
    const next = layers[li + 1];
    place(l.n).forEach((y1) =>
      place(next.n).forEach((y2) => links.push(`M${l.x} ${f(y1)}L${next.x} ${f(y2)}`)),
    );
  });

  // Red dispersa (grafo) a la izquierda, atenuada por el degradado hacia el texto.
  const graph: [number, number][] = Array.from({ length: 16 }, () => [60 + rand() * 560, 30 + rand() * 360]);
  const graphEdges: string[] = [];
  graph.forEach((p, i) => {
    graph
      .map((q, j) => ({ j, d: Math.hypot(p[0] - q[0], p[1] - q[1]) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .forEach((o) => graphEdges.push(`M${f(p[0])} ${f(p[1])}L${f(graph[o.j][0])} ${f(graph[o.j][1])}`));
  });

  const hot = new Set(['1-2', '2-1', '2-4', '3-2', '4-1']);

  return (
    <>
      <path d={links.join('')} stroke={INK} {...S} strokeWidth={0.9} opacity={0.75} />
      <path d={graphEdges.join('')} stroke={WARM} {...S} />
      <g strokeWidth={1.2}>
        {layers.map((l, li) =>
          place(l.n).map((y, ni) => {
            const isHot = hot.has(`${li}-${ni}`);
            return (
              <circle
                key={`${li}-${ni}`}
                cx={l.x}
                cy={f(y)}
                r={isHot ? 9 : 7}
                fill={isHot ? RED : '#fffdfa'}
                fillOpacity={isHot ? 0.55 : 1}
                stroke={isHot ? RED : INK}
              />
            );
          }),
        )}
      </g>
      <g fill="#fffdfa" stroke={WARM} strokeWidth={1.2}>
        {graph.map(([x, y], i) => <circle key={i} cx={f(x)} cy={f(y)} r={4.5} />)}
      </g>
    </>
  );
}

/* ---------- 5. Tecnologías de la información ---------- */

function TechnologyBackdrop() {
  const chart = { x: 722, y: 150, w: 130, h: 120 };
  const rowsY = [166, 186, 206, 226, 246];
  const targetsLeft = [52, 108, 164, 232, 300];
  const targetsRight = [60, 126, 214, 290, 360];

  const left: string[] = [];
  const right: string[] = [];
  const pads: React.ReactElement[] = [];

  rowsY.forEach((py, k) => {
    // Pistas con quiebres a 45° hacia los pads laterales.
    const ty = targetsLeft[k];
    const x1 = chart.x - 14 - k * 10;
    const x2 = x1 - Math.abs(ty - py);
    left.push(`M${chart.x - 12} ${py}H${x1}L${f(x2)} ${ty}H${560 - k * 16}`);
    pads.push(<circle key={`l${k}`} cx={560 - k * 16} cy={ty} r={5.5} />);

    const ry = targetsRight[k];
    const rx1 = chart.x + chart.w + 14 + k * 10;
    const rx2 = rx1 + Math.abs(ry - py);
    right.push(`M${chart.x + chart.w + 12} ${py}H${rx1}L${f(rx2)} ${ry}H${1180 - (4 - k) * 6}`);
    pads.push(<circle key={`r${k}`} cx={1180 - (4 - k) * 6} cy={ry} r={5.5} />);
  });

  // Pines del chip.
  const pins: string[] = [];
  rowsY.forEach((py) => {
    pins.push(`M${chart.x - 12} ${py}H${chart.x}`, `M${chart.x + chart.w} ${py}H${chart.x + chart.w + 12}`);
  });
  [748, 776, 804, 832].forEach((px) => pins.push(`M${px} ${chart.y - 12}V${chart.y}`, `M${px} ${chart.y + chart.h}V${chart.y + chart.h + 12}`));

  // Trazas de comunicación: arcos concéntricos tipo señal.
  const arc = { x: 1085, y: 352 };
  const arcs = [22, 44, 66, 88].map((r) => {
    const a0 = (-85 * Math.PI) / 180;
    const a1 = (-5 * Math.PI) / 180;
    return `M${f(arc.x + r * Math.cos(a0))} ${f(arc.y + r * Math.sin(a0))}A${r} ${r} 0 0 1 ${f(arc.x + r * Math.cos(a1))} ${f(arc.y + r * Math.sin(a1))}`;
  });

  return (
    <>
      <g stroke={RED} {...S} opacity={0.9}>
        {left.map((d, i) => <path key={`a${i}`} d={d} />)}
        {right.map((d, i) => <path key={`b${i}`} d={d} />)}
      </g>
      <g stroke={INK} {...S}>
        <rect x={chart.x} y={chart.y} width={chart.w} height={chart.h} rx={8} />
        <rect x={chart.x + 28} y={chart.y + 26} width={chart.w - 56} height={chart.h - 52} rx={4} strokeDasharray="4 5" />
        <path d={pins.join('')} />
        <path d="M520 352H640L664 328H772" />
        <path d="M520 372H650L674 348H772" strokeDasharray="2 7" />
      </g>
      <g fill="#fffdfa" stroke={RED} strokeWidth={1.4}>{pads}</g>
      <g stroke={RED} strokeWidth={1.2} fill="none">
        <circle cx={776} cy={328} r={4} />
        <circle cx={776} cy={348} r={4} />
      </g>
      <g stroke={WARM} {...S}>
        {arcs.map((d, i) => <path key={i} d={d} />)}
      </g>
      <circle cx={arc.x} cy={arc.y} r={3.5} fill={RED} stroke="none" />
    </>
  );
}

/* ---------- 6. Ciencia, Tecnología y Sociedad ---------- */

function SocietyBackdrop() {
  const rand = rng(33);
  const communities = [
    { cx: 800, cy: 150, r: 92, n: 6 },
    { cx: 1010, cy: 270, r: 110, n: 7 },
    { cx: 1118, cy: 92, r: 62, n: 5 },
  ];

  const people: { x: number; y: number }[][] = communities.map((c, ci) =>
    Array.from({ length: c.n }, (_, i) => {
      const a = (i / c.n) * Math.PI * 2 + ci * 0.6 + rand() * 0.25;
      return { x: c.cx + Math.cos(a) * c.r, y: c.cy + Math.sin(a) * c.r };
    }),
  );

  // Vínculos dentro de cada comunidad (curvas hacia el centro).
  const ties: string[] = [];
  communities.forEach((c, ci) => {
    const p = people[ci];
    p.forEach((a, i) => {
      [1, 2].forEach((step) => {
        const b = p[(i + step) % p.length];
        ties.push(`M${f(a.x)} ${f(a.y)}Q${f(c.cx + (a.x - c.cx) * 0.25)} ${f(c.cy + (a.y - c.cy) * 0.25)} ${f(b.x)} ${f(b.y)}`);
      });
    });
  });

  // Puentes entre comunidades.
  const bridges = [
    [people[0][1], people[1][4]],
    [people[0][5], people[2][3]],
    [people[1][1], people[2][0]],
  ].map(([a, b]) => {
    const mx = (a.x + b.x) / 2 + 36;
    const my = (a.y + b.y) / 2 - 30;
    return `M${f(a.x)} ${f(a.y)}Q${f(mx)} ${f(my)} ${f(b.x)} ${f(b.y)}`;
  });

  // Figura abstracta de persona: cabeza y hombros.
  const person = (x: number, y: number, s: number, key: string) => (
    <g key={key} transform={`translate(${f(x)} ${f(y)}) scale(${s})`}>
      <circle cx={0} cy={-9} r={6.2} fill="#fffdfa" stroke={RED} />
      <path d="M-11 12Q-11 0 0 0Q11 0 11 12" fill="#fffdfa" stroke={RED} />
    </g>
  );

  return (
    <>
      <g stroke={WARM} {...S} strokeDasharray="3 7">
        {communities.map((c, i) => <circle key={i} cx={c.cx} cy={c.cy} r={c.r + 26} />)}
      </g>
      {/* Círculos solapados: ámbitos que se cruzan (ciencia, tecnología, sociedad). */}
      <g stroke={INK} {...S} opacity={0.75}>
        <circle cx={650} cy={292} r={44} />
        <circle cx={700} cy={292} r={44} />
        <circle cx={675} cy={334} r={44} />
      </g>
      <path d={ties.join('')} stroke={INK} {...S} />
      <path d={bridges.join('')} stroke={RED} {...S} strokeDasharray="6 6" />
      <g strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
        {people.flatMap((group, ci) => group.map((p, i) => person(p.x, p.y, 1, `${ci}-${i}`)))}
      </g>
    </>
  );
}

/* ---------- selector ---------- */

const BACKDROPS: Record<ResearchTheme, () => React.ReactElement> = {
  mathematics: MathematicsBackdrop,
  data: DataBackdrop,
  computing: ComputingBackdrop,
  'artificial-intelligence': ArtificialIntelligenceBackdrop,
  technology: TechnologyBackdrop,
  society: SocietyBackdrop,
};

export function FeaturedPublicationBackdrop({ theme }: { theme: ResearchTheme }) {
  const Backdrop = BACKDROPS[theme];
  return (
    <div className="featured-paper-backdrop" data-backdrop={theme} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMid slice" focusable="false">
        <Backdrop />
      </svg>
    </div>
  );
}

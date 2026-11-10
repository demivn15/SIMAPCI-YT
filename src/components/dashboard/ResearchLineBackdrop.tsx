import React, { useEffect, useRef, type RefObject } from 'react';
import type { OfficialResearchLine } from '../../types';
import './ResearchLineBackdrop.css';

/**
 * Fondos abstractos del carrusel: un motivo SVG distinto por línea de investigación.
 *
 * - Sin texto ni números. Todo se dibuja con `currentColor`; el color real lo pone el CSS
 *   según la escuela (`--school-accent` en `.featured-paper-card[data-school]`).
 * - Lienzo de 640×360; el motivo se concentra a la derecha y el CSS lo desvanece hacia
 *   la izquierda para no competir con el título, los autores ni los controles.
 */

type Node = React.ReactNode;

const W = 640;
const H = 360;
const f = (n: number) => Math.round(n * 10) / 10;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const polar = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
const toPath = (pts: ReadonlyArray<readonly [number, number]>, close = false) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join(' ') + (close ? ' Z' : '');

// Generador pseudoaleatorio determinista: el fondo no cambia entre renderizados.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const thin = { ...line, strokeWidth: 1 } as const;
const solid = { fill: 'currentColor', stroke: 'none' } as const;

// ───────────────────────── ECMC ─────────────────────────

function Differential(): Node {
  const field = range(14).flatMap((i) => range(8).map((j) => {
    const x = 235 + i * 30, y = 38 + j * 42;
    const a = Math.sin(x / 85) * Math.cos(y / 65) * 1.1;
    const dx = Math.cos(a) * 9, dy = Math.sin(a) * 9;
    return <path key={`${i}-${j}`} d={`M${f(x - dx)} ${f(y - dy)}L${f(x + dx)} ${f(y + dy)}`} {...thin} opacity={0.55} />;
  }));
  const curve = (y0: number) => {
    const pts: Array<readonly [number, number]> = [];
    let y = y0;
    for (let x = 235; x <= 625; x += 6) {
      pts.push([x, y]);
      y += Math.tan(Math.sin(x / 85) * Math.cos(y / 65) * 1.1) * 6;
    }
    return <path d={toPath(pts)} {...line} strokeWidth={2.2} />;
  };
  return <g>{field}{[70, 170, 270].map((y) => <g key={y}>{curve(y)}</g>)}</g>;
}

function DataScience(): Node {
  const r = rng(11);
  const dots = range(46).map((i) => {
    const x = 250 + r() * 360;
    const y = 300 - (x - 250) * 0.5 + (r() - 0.5) * 120;
    return <circle key={i} cx={f(x)} cy={f(y)} r={f(2.4 + r() * 2.6)} {...solid} opacity={0.55} />;
  });
  const bars = range(9).map((i) => <rect key={i} x={262 + i * 40} y={330 - [30, 52, 40, 70, 58, 86, 74, 96, 110][i]} width={22} height={[30, 52, 40, 70, 58, 86, 74, 96, 110][i]} rx={3} {...solid} opacity={0.14} />);
  return <g>{bars}<path d="M250 300 L615 118" {...line} strokeWidth={2.2} strokeDasharray="2 9" />{dots}</g>;
}

function ScientificComputing(): Node {
  const pt = (i: number, j: number) => [250 + i * 31 + 12 * Math.sin(j * 0.9), 28 + j * 38 + 13 * Math.cos(i * 0.7)] as const;
  const out: Node[] = [];
  for (let i = 0; i < 13; i++) for (let j = 0; j < 9; j++) {
    const p = pt(i, j);
    if (i < 12) out.push(<path key={`h${i}-${j}`} d={toPath([p, pt(i + 1, j)])} {...thin} opacity={0.7} />);
    if (j < 8) out.push(<path key={`v${i}-${j}`} d={toPath([p, pt(i, j + 1)])} {...thin} opacity={0.7} />);
    if (i < 12 && j < 8) out.push(<path key={`d${i}-${j}`} d={toPath([p, pt(i + 1, j + 1)])} {...thin} opacity={0.4} />);
  }
  return <g>{out}{range(9).map((j) => <circle key={j} cx={f(pt(8, j)[0])} cy={f(pt(8, j)[1])} r={3.2} {...solid} />)}</g>;
}

function ArtificialIntelligence(): Node {
  const layers = [3, 5, 6, 5, 3];
  const nodes = layers.map((n, li) => range(n).map((k) => [270 + li * 85, 180 + (k - (n - 1) / 2) * 52] as const));
  const links: Node[] = [];
  nodes.forEach((layer, li) => {
    if (li === nodes.length - 1) return;
    layer.forEach((a, ai) => nodes[li + 1].forEach((b, bi) => links.push(
      <path key={`${li}-${ai}-${bi}`} d={toPath([a, b])} {...thin} opacity={(ai + bi) % 3 === 0 ? 0.65 : 0.22} />,
    )));
  });
  return <g>{links}{nodes.flat().map(([x, y], i) => <circle key={i} cx={x} cy={y} r={6.5} fill="none" stroke="currentColor" strokeWidth={1.8} />)}{nodes[2].map(([x, y], i) => <circle key={`c${i}`} cx={x} cy={y} r={2.6} {...solid} />)}</g>;
}

function InformationTechnology(): Node {
  const traces = [
    'M640 60 H520 L490 90 H400 L370 120 H250', 'M640 110 H560 L530 140 H430', 'M640 160 H580 L550 190 H470 L440 220 H300',
    'M640 210 H540 L510 240 H420', 'M640 260 H600 L570 290 H450 L420 320 H320', 'M640 310 H560 L540 330 H500',
  ];
  return (
    <g>
      {traces.map((d) => <path key={d} d={d} {...line} opacity={0.75} />)}
      {[[250, 120], [300, 220], [430, 140], [420, 240], [320, 320], [500, 330]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={5} fill="none" stroke="currentColor" strokeWidth={1.8} />)}
      <rect x={470} y={130} width={92} height={92} rx={8} {...line} strokeWidth={2} />
      <rect x={490} y={150} width={52} height={52} rx={4} {...solid} opacity={0.2} />
      {range(5).map((i) => <g key={i}><path d={`M${482 + i * 18} 130V114`} {...line} /><path d={`M${482 + i * 18} 222V238`} {...line} /></g>)}
    </g>
  );
}

function ScienceTechSociety(): Node {
  return (
    <g>
      <circle cx={400} cy={160} r={96} {...line} strokeWidth={2} />
      <circle cx={485} cy={160} r={96} {...line} strokeWidth={2} />
      <circle cx={442} cy={234} r={96} {...line} strokeWidth={2} />
      <circle cx={442} cy={184} r={34} {...solid} opacity={0.16} />
      <circle cx={442} cy={184} r={150} {...thin} strokeDasharray="2 8" opacity={0.7} />
      {range(12).map((i) => { const [x, y] = polar(442, 184, 150, (i / 12) * Math.PI * 2); return <circle key={i} cx={f(x)} cy={f(y)} r={i % 3 === 0 ? 5 : 2.6} {...solid} />; })}
    </g>
  );
}

// ───────────────────────── ECAA ─────────────────────────

function Agricultural(): Node {
  const rows = range(8).map((i) => {
    const y0 = 90 + i * 34;
    return `M200 ${y0 + 40} C330 ${y0 - 30} 470 ${y0 + 60} 640 ${y0 - 10}`;
  });
  const r = rng(5);
  const sprouts = rows.flatMap((_, i) => range(5).map((k) => {
    const x = 270 + k * 80 + (i % 2) * 30;
    const y = 90 + i * 34 + 40 - 70 * (x - 200) / 440 + Math.sin((x - 200) / 70) * 22 + (r() - 0.5) * 4;
    return (
      <g key={`${i}-${k}`} transform={`translate(${f(x)} ${f(y)})`}>
        <path d="M0 0V-14" {...thin} />
        <ellipse cx={-6} cy={-14} rx={7} ry={3} transform="rotate(-35 -6 -14)" {...solid} opacity={0.55} />
        <ellipse cx={6} cy={-16} rx={7} ry={3} transform="rotate(35 6 -16)" {...solid} opacity={0.55} />
      </g>
    );
  }));
  return <g>{rows.map((d, i) => <path key={i} d={d} {...line} opacity={0.5} />)}{sprouts}</g>;
}

function AgroMarket(): Node {
  const hs = [46, 70, 62, 104, 92, 140, 128, 176];
  const pts = hs.map((h, i) => [290 + i * 46, 322 - h - 24] as const);
  return (
    <g>
      {hs.map((h, i) => <rect key={i} x={272 + i * 46} y={322 - h} width={34} height={h} rx={4} {...solid} opacity={0.16 + i * 0.015} />)}
      <path d={toPath(pts)} {...line} strokeWidth={2.2} />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={5.2} fill="none" stroke="currentColor" strokeWidth={2} />)}
      <circle cx={560} cy={74} r={44} {...line} /><circle cx={560} cy={74} r={30} {...thin} strokeDasharray="3 5" />
      <circle cx={500} cy={96} r={26} {...line} opacity={0.6} />
      <path d="M262 330H625" {...line} opacity={0.5} />
    </g>
  );
}

function AnimalSciences(): Node {
  const paw = (x: number, y: number, rot: number, s: number, k: string) => (
    <g key={k} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} {...solid} opacity={0.62}>
      <ellipse cx={0} cy={8} rx={15} ry={12} />
      {[[-18, -8], [-6, -18], [8, -18], [20, -8]].map(([cx, cy]) => <ellipse key={`${cx}`} cx={cx} cy={cy} rx={5.5} ry={7.5} />)}
    </g>
  );
  return (
    <g>
      <path d="M180 300 C280 230 360 290 450 240 S580 210 640 250 V360 H180Z" {...solid} opacity={0.1} />
      <path d="M220 330 C320 270 400 330 500 280 S600 260 640 290 V360 H220Z" {...solid} opacity={0.12} />
      <path d="M180 300 C280 230 360 290 450 240 S580 210 640 250" {...line} opacity={0.6} />
      <path d="M220 330 C320 270 400 330 500 280 S600 260 640 290" {...line} opacity={0.45} />
      {paw(330, 205, -20, 1.15, 'a')}{paw(405, 160, 10, 1.05, 'b')}{paw(484, 118, -12, 0.95, 'c')}{paw(560, 70, 18, 0.85, 'd')}
      <circle cx={560} cy={250} r={4} {...solid} opacity={0.5} /><circle cx={590} cy={232} r={3} {...solid} opacity={0.5} />
    </g>
  );
}

function gearPoints(cx: number, cy: number, ro: number, ri: number, teeth: number): string {
  const pts: Array<readonly [number, number]> = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, d = Math.PI / teeth;
    pts.push(polar(cx, cy, ri, a - d * 0.9), polar(cx, cy, ro, a - d * 0.5), polar(cx, cy, ro, a + d * 0.1), polar(cx, cy, ri, a + d * 0.5));
  }
  return toPath(pts, true);
}

function AgroInnovation(): Node {
  const leaf = (x: number, y: number, rot: number, s: number, k: string) => (
    <path key={k} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} d="M0 0 C 20 -22 54 -22 74 0 C 54 22 20 22 0 0Z M0 0 H74" {...line} opacity={0.75} />
  );
  return (
    <g>
      <path d={gearPoints(450, 175, 92, 76, 14)} {...line} strokeWidth={2} />
      <circle cx={450} cy={175} r={52} {...thin} /><circle cx={450} cy={175} r={22} {...solid} opacity={0.2} />
      <path d={gearPoints(572, 276, 52, 42, 10)} {...line} /><circle cx={572} cy={276} r={14} {...thin} />
      <path d={gearPoints(330, 288, 38, 30, 8)} {...line} opacity={0.6} />
      {leaf(468, 150, -35, 0.7, 'a')}{leaf(500, 205, 25, 0.5, 'b')}
      {range(3).map((i) => <path key={i} d={`M${560 + i * 22} ${70 + i * 8} q9 14 0 22 q-9 -8 0 -22Z`} {...line} opacity={0.7} />)}
    </g>
  );
}

// ───────────────────────── ECBI ─────────────────────────

function Ecology(): Node {
  const out: Node[] = [];
  const grow = (x: number, y: number, a: number, len: number, depth: number, k: string) => {
    if (depth === 0) { out.push(<circle key={`l${k}`} cx={f(x)} cy={f(y)} r={4.5} {...solid} opacity={0.6} />); return; }
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    out.push(<path key={k} d={`M${f(x)} ${f(y)}L${f(x2)} ${f(y2)}`} {...line} strokeWidth={Math.max(1, depth * 0.55)} opacity={0.8} />);
    grow(x2, y2, a - 0.42, len * 0.74, depth - 1, k + 'a');
    grow(x2, y2, a + 0.38, len * 0.74, depth - 1, k + 'b');
  };
  grow(470, 350, -Math.PI / 2, 78, 7, 't');
  return <g>{out}{range(4).map((i) => <ellipse key={i} cx={470} cy={352} rx={50 + i * 42} ry={7 + i * 3} {...thin} opacity={0.5 - i * 0.1} />)}</g>;
}

function Microbiology(): Node {
  const r = rng(21);
  const colonies = range(26).map((i) => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 108;
    const [x, y] = polar(470, 180, d, a);
    return <circle key={i} cx={f(x)} cy={f(y)} r={f(3 + r() * 9)} fill={i % 3 ? 'none' : 'currentColor'} fillOpacity={0.3} stroke="currentColor" strokeWidth={1.4} />;
  });
  const rods = range(9).map((i) => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 100;
    const [x, y] = polar(470, 180, d, a);
    return <rect key={`r${i}`} x={f(x - 12)} y={f(y - 4)} width={24} height={8} rx={4} transform={`rotate(${f(r() * 180)} ${f(x)} ${f(y)})`} {...line} strokeWidth={1.3} />;
  });
  return <g><circle cx={470} cy={180} r={142} {...line} strokeWidth={2} /><circle cx={470} cy={180} r={126} {...thin} strokeDasharray="1 7" />{colonies}{rods}</g>;
}

function AquaticSystems(): Node {
  const waves = range(8).map((i) => {
    const y = 90 + i * 30, amp = 12 + (i % 3) * 5, ph = i * 0.8;
    const pts = range(66).map((k) => [220 + k * 6.5, y + amp * Math.sin(k / 6 + ph)] as const);
    return <path key={i} d={toPath(pts)} {...line} opacity={0.75 - i * 0.05} />;
  });
  const r = rng(8);
  const bubbles = range(14).map((i) => <circle key={i} cx={f(250 + r() * 370)} cy={f(40 + r() * 280)} r={f(2.5 + r() * 7)} fill="none" stroke="currentColor" strokeWidth={1.3} opacity={0.7} />);
  return <g>{waves}{bubbles}</g>;
}

function CellMolecularGenetics(): Node {
  const A = (x: number, ph: number) => 180 + 62 * Math.sin(x / 38 + ph);
  const s1 = range(80).map((k) => [220 + k * 5.3, A(220 + k * 5.3, 0)] as const);
  const s2 = range(80).map((k) => [220 + k * 5.3, A(220 + k * 5.3, Math.PI)] as const);
  const rungs = range(27).map((k) => {
    const x = 225 + k * 15.5;
    return <path key={k} d={`M${f(x)} ${f(A(x, 0))}L${f(x)} ${f(A(x, Math.PI))}`} {...thin} opacity={0.35 + 0.4 * Math.abs(Math.cos(x / 38))} />;
  });
  return <g>{rungs}<path d={toPath(s1)} {...line} strokeWidth={2.4} /><path d={toPath(s2)} {...line} strokeWidth={2.4} opacity={0.65} />{[0, 1, 2].map((i) => <circle key={i} cx={f(520 + i * 36)} cy={f(300 - i * 8)} r={14 - i * 3} {...thin} />)}</g>;
}

function Biomedicine(): Node {
  const ecg: Array<readonly [number, number]> = [];
  for (let b = 0; b < 3; b++) {
    const x = 230 + b * 130;
    ecg.push([x, 190], [x + 18, 190], [x + 28, 176], [x + 38, 190], [x + 50, 190], [x + 56, 210], [x + 64, 90], [x + 74, 250], [x + 82, 190], [x + 100, 190], [x + 112, 168], [x + 124, 190]);
  }
  ecg.push([630, 190]);
  return (
    <g>
      <path d={toPath(ecg)} {...line} strokeWidth={2.4} />
      <path d="M230 190H630" {...thin} strokeDasharray="2 8" opacity={0.5} />
      <circle cx={540} cy={86} r={34} {...line} /><circle cx={540} cy={86} r={12} {...solid} opacity={0.3} />
      <circle cx={440} cy={290} r={24} {...line} opacity={0.7} /><circle cx={586} cy={282} r={40} {...line} opacity={0.6} /><circle cx={586} cy={282} r={14} {...solid} opacity={0.22} />
      <path d="M300 70h30M315 55v30" {...line} strokeWidth={2.4} />
    </g>
  );
}

function Biomaterials(): Node {
  const frontPores = range(3).flatMap((row) => range(5).map((col) => {
    const cx = 304 + col * 42, cy = 207 + row * 38;
    const points = range(6).map((i) => polar(cx, cy, 14, Math.PI / 6 + (i * Math.PI) / 3));
    return <path key={`front-${row}-${col}`} d={toPath(points, true)} fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeWidth={1.2} opacity={0.82} />;
  }));
  const topPores = [365, 415, 465].map((cx) => {
    const points = range(6).map((i) => polar(cx, 164, 12, Math.PI / 6 + (i * Math.PI) / 3));
    return <path key={`top-${cx}`} d={toPath(points, true)} fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeWidth={1.2} opacity={0.76} />;
  });

  return (
    <g>
      {/* Células sobre un andamio poroso de biomaterial. */}
      {[365, 420, 475].map((cx, i) => (
        <g key={`cell-${cx}`} opacity={0.82}>
          <circle cx={cx} cy={104 + (i % 2) * 5} r={17} fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeWidth={1.6} />
          <circle cx={cx + 2} cy={105 + (i % 2) * 5} r={6} {...solid} opacity={0.36} />
          <circle cx={cx - 5} cy={98 + (i % 2) * 5} r={2} {...solid} opacity={0.62} />
        </g>
      ))}
      <path d="M280 184L350 143H580L510 184Z" fill="currentColor" fillOpacity={0.11} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M280 184H510V310H280Z" fill="currentColor" fillOpacity={0.045} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M510 184L580 143V269L510 310Z" fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
      {topPores}
      {frontPores}
      <path d="M263 320H508L592 273" {...thin} opacity={0.65} />
      <path d="M302 176L333 158M516 179L550 159" {...thin} opacity={0.55} />
    </g>
  );
}

// ───────────────────────── ECFN ─────────────────────────

function Nanostructured(): Node {
  const R = 19, dx = R * Math.sqrt(3), out: Node[] = [];
  for (let row = 0; row < 11; row++) for (let col = 0; col < 14; col++) {
    const cx = 250 + col * dx + (row % 2) * (dx / 2), cy = 40 + row * R * 1.5;
    const vs = range(6).map((k) => polar(cx, cy, R, Math.PI / 6 + (k * Math.PI) / 3));
    out.push(<path key={`${row}-${col}`} d={toPath(vs, true)} {...thin} opacity={0.5} />);
    if ((row + col) % 3 === 0) out.push(<circle key={`d${row}-${col}`} cx={f(vs[0][0])} cy={f(vs[0][1])} r={3} {...solid} />);
  }
  return <g>{out}<ellipse cx={540} cy={86} rx={46} ry={14} {...line} /><path d="M494 86V250M586 86V250" {...line} /><ellipse cx={540} cy={250} rx={46} ry={14} {...line} />{range(5).map((i) => <ellipse key={i} cx={540} cy={110 + i * 28} rx={46} ry={14} {...thin} opacity={0.4} />)}</g>;
}

function TheoreticalMaterials(): Node {
  const iso = (x: number, y: number, z: number) => [450 + (x - y) * 44, 190 + (x + y) * 25 - z * 52] as const;
  const out: Node[] = [];
  const N = 3;
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    const p = iso(x - 1, y - 1, z - 1);
    if (x < N - 1) out.push(<path key={`x${x}${y}${z}`} d={toPath([p, iso(x, y - 1, z - 1)])} {...thin} opacity={0.7} />);
    if (y < N - 1) out.push(<path key={`y${x}${y}${z}`} d={toPath([p, iso(x - 1, y, z - 1)])} {...thin} opacity={0.7} />);
    if (z < N - 1) out.push(<path key={`z${x}${y}${z}`} d={toPath([p, iso(x - 1, y - 1, z)])} {...thin} opacity={0.7} />);
    out.push(<circle key={`p${x}${y}${z}`} cx={f(p[0])} cy={f(p[1])} r={(x + y + z) % 2 ? 6 : 4} fill="currentColor" fillOpacity={(x + y + z) % 2 ? 0.45 : 0.9} />);
  }
  return <g>{out}<path d={toPath([iso(-1, -1, -1), iso(1, -1, -1), iso(1, 1, -1), iso(-1, 1, -1)], true)} {...line} strokeDasharray="3 6" opacity={0.6} /></g>;
}

function ComplexSystems(): Node {
  let x = 1, y = 1, z = 1;
  const pts: Array<readonly [number, number]> = [];
  for (let i = 0; i < 2600; i++) {
    const dt = 0.008;
    const dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - (8 / 3) * z;
    x += dx * dt; y += dy * dt; z += dz * dt;
    if (i > 100 && i % 2 === 0) pts.push([455 + x * 9.5, 345 - z * 6.6]);
  }
  return (
    <g>
      <path d={toPath(pts)} {...line} strokeWidth={1.1} opacity={0.85} />
      {[[300, 90], [585, 60], [610, 290], [270, 300]].map(([cx, cy]) => <g key={`${cx}`}><circle cx={cx} cy={cy} r={6} fill="none" stroke="currentColor" strokeWidth={1.8} /><circle cx={cx} cy={cy} r={2} {...solid} /></g>)}
      <path d="M300 90L585 60L610 290L270 300Z" {...thin} strokeDasharray="2 9" opacity={0.6} />
    </g>
  );
}

function Astrophysics(): Node {
  const r = rng(77);
  const stars: Node[] = [];
  for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 90; i++) {
    const t = i / 90 * 4.4, rad = 10 * Math.exp(0.52 * t);
    const [px, py] = polar(0, 0, rad, t + arm * Math.PI);
    stars.push(<circle key={`${arm}-${i}`} cx={f(465 + px + (r() - 0.5) * 16)} cy={f(185 + py * 0.62 + (r() - 0.5) * 12)} r={f(0.9 + r() * 2.3)} {...solid} opacity={0.35 + r() * 0.5} />);
  }
  return (
    <g>
      {stars}
      <circle cx={465} cy={185} r={14} {...solid} opacity={0.35} /><circle cx={465} cy={185} r={26} {...thin} />
      <ellipse cx={465} cy={185} rx={190} ry={98} transform="rotate(-18 465 185)" {...thin} strokeDasharray="3 7" />
      <ellipse cx={465} cy={185} rx={140} ry={70} transform="rotate(-18 465 185)" {...thin} opacity={0.5} />
      <circle cx={331} cy={147} r={7} {...solid} /><circle cx={600} cy={226} r={4} {...solid} />
    </g>
  );
}

function LowCostInstrumentation(): Node {
  const wave = range(60).map((k) => [300 + k * 5.5, 168 + 52 * Math.sin(k / 4.2) * (0.75 + 0.25 * Math.sin(k / 11)) + 6 * Math.sin(k * 2.3)] as const);
  return (
    <g>
      <rect x={290} y={60} width={340} height={216} rx={14} {...line} strokeWidth={2} />
      {range(7).map((i) => <path key={`v${i}`} d={`M${290 + (i + 1) * 42.5} 72V264`} {...thin} opacity={0.35} />)}
      {range(5).map((i) => <path key={`h${i}`} d={`M302 ${60 + (i + 1) * 36}H618`} {...thin} opacity={0.35} />)}
      <path d={toPath(wave)} {...line} strokeWidth={2.4} />
      {[340, 410, 480].map((x) => <g key={x}><circle cx={x} cy={314} r={15} {...line} /><path d={`M${x} 314L${x + 8} 305`} {...line} /></g>)}
      <path d="M560 314H625M575 300v28M590 300v28" {...line} opacity={0.7} />
    </g>
  );
}

function Acoustics(): Node {
  const arcs = range(9).map((i) => {
    const rad = 46 + i * 30, a = 0.75 - i * 0.02;
    const [x1, y1] = polar(300, 180, rad, -a), [x2, y2] = polar(300, 180, rad, a);
    return <path key={i} d={`M${f(x1)} ${f(y1)}A${rad} ${rad} 0 0 1 ${f(x2)} ${f(y2)}`} {...line} strokeWidth={2} opacity={0.85 - i * 0.07} />;
  });
  const env = range(70).map((k) => [350 + k * 4.2, 310 + 40 * Math.exp(-k / 30) * Math.sin(k / 2.4)] as const);
  return <g>{arcs}<circle cx={300} cy={180} r={8} {...solid} /><path d={toPath(env)} {...line} strokeWidth={1.4} opacity={0.65} /></g>;
}

// ───────────────────────── ECTEA ─────────────────────────

function Geology(): Node {
  const layer = (base: number, amp: number, ph: number, k: number) =>
    range(55).map((i) => [200 + i * 8.2, base + amp * Math.sin(i / 7 + ph) + (i > 30 ? 14 : 0)] as const);
  const out = range(7).map((k) => {
    const pts = layer(70 + k * 36, 22, k * 0.25, k);
    return <path key={k} d={toPath(pts) + ' L640 360 L200 360Z'} fill="currentColor" fillOpacity={k % 2 ? 0.1 : 0.05} stroke="currentColor" strokeWidth={1.5} />;
  });
  return <g>{out}<path d="M418 30L478 340" {...line} strokeWidth={2.2} strokeDasharray="10 7" /></g>;
}

function ClimateEnvironment(): Node {
  const flows = range(8).map((i) => {
    const y = 120 + i * 30;
    return <path key={i} d={`M200 ${y} C 300 ${y - 50} 380 ${y + 50} 460 ${y} S 580 ${y - 40} 640 ${y - 10}`} {...line} opacity={0.75 - i * 0.05} />;
  });
  return (
    <g>
      {flows}
      <circle cx={540} cy={86} r={34} {...solid} opacity={0.3} /><circle cx={540} cy={86} r={34} {...line} />
      {range(14).map((i) => { const [x1, y1] = polar(540, 86, 46, (i / 14) * Math.PI * 2), [x2, y2] = polar(540, 86, i % 2 ? 58 : 66, (i / 14) * Math.PI * 2); return <path key={i} d={`M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`} {...line} />; })}
      <ellipse cx={330} cy={64} rx={64} ry={20} {...thin} /><ellipse cx={330} cy={64} rx={36} ry={10} {...thin} opacity={0.6} />
    </g>
  );
}

function NaturalHazards(): Node {
  const r = rng(91);
  const seis = range(120).map((k) => {
    const burst = k > 34 ? Math.exp(-(k - 34) / 22) * 110 : 6;
    return [210 + k * 3.55, 262 + (r() - 0.5) * 2 * burst * (k > 30 ? 1 : 0.2)] as const;
  });
  return (
    <g>
      {range(5).map((i) => <circle key={i} cx={480} cy={110} r={24 + i * 28} {...line} strokeWidth={1.5} opacity={0.8 - i * 0.14} strokeDasharray={i % 2 ? '4 6' : undefined} />)}
      <circle cx={480} cy={110} r={7} {...solid} />
      <path d={toPath(seis)} {...line} strokeWidth={1.6} />
      <path d="M210 262H640" {...thin} strokeDasharray="2 8" opacity={0.5} />
    </g>
  );
}

function GeoHeritage(): Node {
  const R = 30, dx = R * Math.sqrt(3), out: Node[] = [];
  const r = rng(61);
  for (let row = 0; row < 9; row++) for (let col = 0; col < 8; col++) {
    const cx = 270 + col * dx + (row % 2) * (dx / 2), cy = 50 + row * R * 1.5;
    const hex = range(6).map((k) => polar(cx, cy, R - 2, Math.PI / 6 + (k * Math.PI) / 3));
    const top = range(6).map((k) => polar(cx - 4, cy - 5, R - 12, Math.PI / 6 + (k * Math.PI) / 3));
    const v = r();
    out.push(
      <path key={`o${row}-${col}`} d={toPath(hex, true)} fill="currentColor" fillOpacity={v < 0.25 ? 0.2 : 0.05} stroke="currentColor" strokeWidth={1.3} />,
      <path key={`i${row}-${col}`} d={toPath(top, true)} {...thin} opacity={0.65} />,
    );
  }
  return <g>{out}</g>;
}

function Geomatics(): Node {
  const rings = range(8).map((i) => {
    const R = 28 + i * 20;
    const pts = range(73).map((k) => { const a = (k / 72) * Math.PI * 2; return polar(450, 190, R * (1 + 0.16 * Math.sin(3 * a + 0.8) + 0.08 * Math.sin(5 * a + i * 0.2)), a); });
    return <path key={i} d={toPath(pts, true)} {...line} strokeWidth={i % 4 === 0 ? 2.2 : 1.3} opacity={0.85 - i * 0.05} />;
  });
  return (
    <g>
      {rings}
      <path d="M450 20V360M230 190H640" {...thin} strokeDasharray="3 7" opacity={0.7} />
      <circle cx={450} cy={190} r={9} {...line} strokeWidth={2} /><circle cx={450} cy={190} r={3} {...solid} />
      <ellipse cx={450} cy={190} rx={200} ry={60} transform="rotate(-22 450 190)" {...thin} opacity={0.6} /><circle cx={608} cy={118} r={5} {...solid} />
    </g>
  );
}

// ───────────────────────── ECQI ─────────────────────────

function FunctionalMaterials(): Node {
  const out: Node[] = [];
  for (let i = 0; i < 4; i++) {
    const cy = 100 + i * 52, cx = 450;
    out.push(<path key={`s${i}`} d={`M${cx - 130} ${cy}L${cx} ${cy - 40}L${cx + 130} ${cy}L${cx} ${cy + 40}Z`} fill="currentColor" fillOpacity={0.06 + i * 0.03} stroke="currentColor" strokeWidth={1.6} />);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const px = cx + (a - b) * 26, py = cy + (a + b) * 7.5;
      out.push(<circle key={`${i}-${a}-${b}`} cx={px} cy={py} r={2.3} {...solid} opacity={0.75} />);
    }
  }
  return <g>{out}<path d="M320 100V256M450 60V296M580 100V256" {...thin} strokeDasharray="2 6" opacity={0.6} /></g>;
}

function MedicinalChemistry(): Node {
  const R = 52;
  const ring = (cx: number, cy: number, k: string) => {
    const vs = range(6).map((i) => polar(cx, cy, R, Math.PI / 6 + (i * Math.PI) / 3));
    return <g key={k}><path d={toPath(vs, true)} {...line} strokeWidth={2} /><circle cx={cx} cy={cy} r={R * 0.58} {...thin} /></g>;
  };
  const [sx, sy] = polar(490, 170, R, -Math.PI / 6);
  const [tx, ty] = polar(445, 248, R, Math.PI / 6);
  return (
    <g>
      {ring(400, 170, 'a')}{ring(490, 170, 'b')}{ring(445, 248, 'c')}
      <path d={`M${f(sx)} ${f(sy)}L${f(sx + 30)} ${f(sy - 26)}`} {...line} /><circle cx={f(sx + 37)} cy={f(sy - 32)} r={9} fill="none" stroke="currentColor" strokeWidth={1.8} />
      <path d={`M${f(tx)} ${f(ty)}L${f(tx + 40)} ${f(ty + 6)}L${f(tx + 62)} ${f(ty - 24)}`} {...line} /><circle cx={f(tx + 62)} cy={f(ty - 24)} r={4} {...solid} />
      <path d="M352 140L318 118" {...line} /><circle cx={310} cy={113} r={7} {...solid} opacity={0.5} />
      <g transform="rotate(-32 570 290)"><rect x={510} y={268} width={120} height={44} rx={22} {...line} strokeWidth={2} /><path d="M570 268V312" {...line} /><rect x={510} y={268} width={60} height={44} rx={22} {...solid} opacity={0.2} /></g>
    </g>
  );
}

function SustainableDevelopment(): Node {
  return (
    <g>
      {/* Energía solar: sol, panel fotovoltaico y soporte. */}
      <circle cx={548} cy={66} r={21} {...line} strokeWidth={2} />
      <circle cx={548} cy={66} r={9} {...solid} opacity={0.18} />
      <path d="M548 31V23M548 109V101M513 66H505M591 66H583M523 41L517 35M579 97L573 91M573 41L579 35M517 97L523 91" {...thin} />
      <path d="M365 72L466 72L484 125L383 125Z" {...line} strokeWidth={2} />
      <path d="M389 72L407 125M419 72L437 125M449 72L467 125M374 98H475" {...thin} />
      <path d="M405 125L394 151M459 125L470 151M387 152H478" {...line} />

      {/* Agricultura: surcos, tallo y espigas. */}
      <path d="M278 326C325 299 372 299 419 326M289 344C337 317 384 317 431 344M305 359C348 337 389 337 426 357" {...thin} opacity={0.8} />
      <path d="M340 305C346 261 349 218 346 170" {...line} strokeWidth={2} />
      <path d="M344 268C326 257 318 244 317 228C334 233 344 245 346 259M345 246C362 235 369 222 368 206C352 211 344 224 345 239M346 219C329 208 324 195 326 180C340 186 347 198 347 212" {...line} />
      <path d="M346 186C337 178 335 167 339 156C348 163 351 173 348 183M347 184C355 175 365 174 374 179C367 188 357 190 349 187M345 199C336 193 333 184 336 175" {...thin} />

      {/* Alimentos: cesta de cosecha con frutos y hojas. */}
      <path d="M430 235Q472 171 515 235" {...line} strokeWidth={2} />
      <path d="M418 238Q472 254 527 238L515 300Q472 316 430 300Z" {...line} strokeWidth={2} />
      <path d="M424 256Q472 270 521 256M427 276Q472 290 518 276M434 298L441 255M455 306L458 263M480 307L480 264M501 303L497 258" {...thin} />
      <path d="M447 231C438 217 444 202 459 198C470 209 466 225 451 234Z" fill="currentColor" fillOpacity={0.13} stroke="currentColor" strokeWidth={1.5} />
      <path d="M461 231C454 216 463 202 478 202C486 216 479 229 465 234Z" fill="currentColor" fillOpacity={0.22} stroke="currentColor" strokeWidth={1.5} />
      <path d="M478 231C478 216 491 207 504 213C505 228 493 236 480 235Z" fill="currentColor" fillOpacity={0.1} stroke="currentColor" strokeWidth={1.5} />
      <path d="M456 205Q460 196 468 195M473 209Q477 200 485 198M487 214Q493 206 500 206" {...thin} />

      {/* Medio ambiente: agua y una hoja, vinculadas al paisaje agrícola. */}
      <path d="M570 155C570 155 546 185 546 200A24 24 0 0 0 594 200C594 185 570 155 570 155Z" fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeWidth={1.8} />
      <path d="M566 209C556 195 560 181 575 174C585 187 581 201 566 209ZM566 208L574 184" {...line} />
      <path d="M534 238C548 222 562 218 577 224C573 240 558 249 539 245M538 245L565 226" {...thin} />
    </g>
  );
}

function TheoreticalChemistry(): Node {
  const lobe = (cx: number, cy: number, rot: number, sx: number, k: string) => (
    <path key={k} transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${sx})`} d="M0 0C-26 -30 -34 -78 0 -86C34 -78 26 -30 0 0Z" fill="currentColor" fillOpacity={0.14} stroke="currentColor" strokeWidth={1.6} />
  );
  const r = rng(13);
  const cloud = range(120).map((i) => {
    const a = r() * Math.PI * 2, d = (r() + r() + r()) / 3 * 150;
    const [x, y] = polar(450, 190, d, a);
    return <circle key={i} cx={f(x)} cy={f(y)} r={1.5} {...solid} opacity={0.55} />;
  });
  return (
    <g>
      {cloud}
      {lobe(450, 190, 90, 1.25, 'p1')}{lobe(450, 190, -90, 1.25, 'p2')}
      {lobe(450, 190, 45, 0.75, 'd1')}{lobe(450, 190, 135, 0.75, 'd2')}{lobe(450, 190, 225, 0.75, 'd3')}{lobe(450, 190, 315, 0.75, 'd4')}
      <circle cx={450} cy={190} r={6} {...solid} /><circle cx={450} cy={190} r={170} {...thin} strokeDasharray="2 9" />
    </g>
  );
}

// ───────────────────────── YTLC ─────────────────────────

function EdTechAI(): Node {
  const nodes = [[360, 130], [440, 100], [520, 150], [400, 210], [490, 230], [570, 210]] as const;
  const links = [[0, 1], [1, 2], [0, 3], [1, 3], [1, 4], [2, 4], [2, 5], [3, 4], [4, 5]];
  return (
    <g>
      <rect x={300} y={56} width={300} height={220} rx={16} {...line} strokeWidth={2} />
      <path d="M440 276V306M390 306H490" {...line} strokeWidth={2} />
      {links.map(([a, b]) => <path key={`${a}${b}`} d={toPath([nodes[a], nodes[b]])} {...thin} opacity={0.65} />)}
      {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 8 : 6} fill="currentColor" fillOpacity={i % 2 ? 0.35 : 0.9} stroke="currentColor" strokeWidth={1.6} />)}
      <path d="M612 120h16M620 112v16M284 300h14M291 293v14" {...line} />
    </g>
  );
}

function EnglishMedium(): Node {
  const bubble = (x: number, y: number, w: number, h: number, tail: 'l' | 'r', fillO: number, k: string, lines: number) => (
    <g key={k}>
      <path d={`M${x + 18} ${y}H${x + w - 18}Q${x + w} ${y} ${x + w} ${y + 18}V${y + h - 18}Q${x + w} ${y + h} ${x + w - 18} ${y + h}H${tail === 'r' ? x + w - 50 : x + 70}L${tail === 'r' ? x + w - 28 : x + 40} ${y + h + 24}L${tail === 'r' ? x + w - 80 : x + 46} ${y + h}H${x + 18}Q${x} ${y + h} ${x} ${y + h - 18}V${y + 18}Q${x} ${y} ${x + 18} ${y}Z`} fill="currentColor" fillOpacity={fillO} stroke="currentColor" strokeWidth={1.8} />
      {range(lines).map((i) => <path key={i} d={`M${x + 24} ${y + 26 + i * 20}H${x + w - 24 - (i === lines - 1 ? 60 : 0)}`} {...line} opacity={0.7} />)}
    </g>
  );
  return <g>{bubble(280, 50, 230, 110, 'l', 0.06, 'a', 3)}{bubble(400, 190, 220, 100, 'r', 0.16, 'b', 3)}{bubble(540, 60, 90, 70, 'l', 0.1, 'c', 1)}</g>;
}

function EnglishSpecificPurposes(): Node {
  const cx = 460, cy = 180;
  const sectors = [0, 1, 2].map((i) => {
    const a1 = -0.5 + i * 2.1, a2 = a1 + 0.9;
    const mk = (r: number) => polar(cx, cy, r, a1).concat(polar(cx, cy, r, a2)) as unknown as number[];
    const [ox1, oy1, ox2, oy2] = mk(150), [ix1, iy1, ix2, iy2] = mk(90);
    return <path key={i} d={`M${f(ix1)} ${f(iy1)}L${f(ox1)} ${f(oy1)}A150 150 0 0 1 ${f(ox2)} ${f(oy2)}L${f(ix2)} ${f(iy2)}A90 90 0 0 0 ${f(ix1)} ${f(iy1)}Z`} {...solid} opacity={0.2} />;
  });
  return (
    <g>
      {sectors}
      {[30, 60, 90, 120, 150].map((r) => <circle key={r} cx={cx} cy={cy} r={r} {...line} strokeWidth={r === 150 ? 2.2 : 1.4} opacity={0.8} />)}
      <path d={`M${cx - 175} ${cy}H${cx + 175}M${cx} ${cy - 175}V${cy + 175}`} {...thin} />
      {range(36).map((i) => { const [x1, y1] = polar(cx, cy, 158, (i / 36) * Math.PI * 2), [x2, y2] = polar(cx, cy, i % 3 ? 164 : 172, (i / 36) * Math.PI * 2); return <path key={i} d={`M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`} {...thin} />; })}
      <circle cx={cx} cy={cy} r={7} {...solid} />
      <path d="M580 70L470 172" {...line} strokeWidth={2.2} /><path d="M580 70l-4 22M580 70l-22 -4" {...line} strokeWidth={2.2} />
    </g>
  );
}

function PedagogyTeaching(): Node {
  const steps = range(6).map((i) => <rect key={i} x={250 + i * 58} y={290 - i * 34} width={58} height={70 + i * 34} {...line} fill="currentColor" fillOpacity={0.05 + i * 0.03} />);
  const dots = range(6).map((i) => <circle key={i} cx={279 + i * 58} cy={268 - i * 34} r={9} {...solid} opacity={0.8} />);
  return (
    <g>
      {steps}{dots}
      <path d="M279 244C320 190 400 190 430 140S520 70 590 56" {...thin} strokeDasharray="3 8" />
      <g transform="translate(540 38)"><path d="M0 0L52 -20L104 0L52 20Z" fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" /><path d="M26 10V34Q52 46 78 34V10" {...line} /><path d="M100 2V38" {...line} /></g>
      <path d="M250 330H640" {...thin} opacity={0.6} />
    </g>
  );
}

function SociolinguisticsCulture(): Node {
  const globe = (cx: number, cy: number, R: number, k: string, o: number) => (
    <g key={k} opacity={o}>
      <circle cx={cx} cy={cy} r={R} {...line} strokeWidth={2} />
      {[0.35, 0.7].map((e) => <ellipse key={e} cx={cx} cy={cy} rx={R * e} ry={R} {...thin} />)}
      {[-0.55, 0, 0.55].map((e) => <path key={e} d={`M${f(cx - R * Math.sqrt(1 - e * e))} ${f(cy + R * e)}H${f(cx + R * Math.sqrt(1 - e * e))}`} {...thin} />)}
    </g>
  );
  const ripple = range(3).map((i) => <path key={i} d={`M${300 - i * 18} ${300 + i * 0}c30 -30 60 30 90 0s60 30 90 0`} {...line} opacity={0.7 - i * 0.2} transform={`translate(${i * 12} ${i * 16})`} />);
  return <g>{globe(470, 170, 120, 'a', 1)}{globe(330, 270, 54, 'b', 0.8)}{ripple}<circle cx={560} cy={80} r={4} {...solid} /><circle cx={410} cy={120} r={4} {...solid} /><path d="M410 120Q480 40 560 80" {...thin} strokeDasharray="3 6" /></g>;
}

function LanguageAssessment(): Node {
  const widths = [250, 190, 280, 150, 220];
  return (
    <g>
      {widths.map((w, i) => {
        const y = 70 + i * 52;
        return (
          <g key={i}>
            <circle cx={290} cy={y} r={15} {...line} />
            {i !== 3 ? <path d={`M282 ${y}L288 ${y + 6}L299 ${y - 6}`} {...line} strokeWidth={2.2} /> : <path d={`M283 ${y}H297`} {...line} strokeWidth={2.2} />}
            <rect x={325} y={y - 9} width={300} height={18} rx={9} {...thin} opacity={0.6} />
            <rect x={325} y={y - 9} width={w} height={18} rx={9} {...solid} opacity={0.18 + i * 0.03} />
            {range(5).map((k) => <circle key={k} cx={349 + k * 66} cy={y} r={2.2} {...solid} opacity={0.6} />)}
          </g>
        );
      })}
      <path d="M325 330H625" {...thin} opacity={0.5} />
    </g>
  );
}

const MOTIFS: Record<OfficialResearchLine, () => Node> = {
  // ECMC
  'Ecuaciones diferenciales, análisis matemático, modelamiento y optimización': Differential,
  'Ciencia de datos': DataScience,
  'Computación científica': ScientificComputing,
  'Inteligencia artificial': ArtificialIntelligence,
  'Tecnologías de la información': InformationTechnology,
  'Ciencia, Tecnología y Sociedad': ScienceTechSociety,
  // ECAA
  'Ciencias Agrícolas': Agricultural,
  'Investigación del mercado de productos agroindustriales': AgroMarket,
  'Ciencias Animales': AnimalSciences,
  'I+D+i Agroindustrial': AgroInnovation,
  // ECBI
  'Ecología, evolución y conservación de ecosistemas terrestres': Ecology,
  'Microbiología': Microbiology,
  'Biología de Sistemas Acuáticos': AquaticSystems,
  'Biología celular, biología molecular y genética': CellMolecularGenetics,
  'Biomedicina': Biomedicine,
  'Biomateriales': Biomaterials,
  // ECFN
  'Materiales nanoestructurados, síntesis y caracterización': Nanostructured,
  'Ciencia de materiales teórica': TheoreticalMaterials,
  'Física de sistemas complejos e interdisciplinarios': ComplexSystems,
  'Astrofísica, Cosmología y Física Teórica': Astrophysics,
  'Desarrollo Instrumentación científica de bajo costo': LowCostInstrumentation,
  'Acústica y Aplicaciones': Acoustics,
  // ECTEA
  'Geología física y aplicada': Geology,
  'Medioambiente y clima': ClimateEnvironment,
  'Riesgos y amenazas naturales': NaturalHazards,
  'Patrimonio geológico, geoeducación y sostenibilidad': GeoHeritage,
  'Geomática aplicada a las geociencias': Geomatics,
  // ECQI
  'Materiales funcionales': FunctionalMaterials,
  'Química medicinal y farmacología molecular': MedicinalChemistry,
  'Desarrollo sostenible: Energía, alimentos, agricultura y medio ambiente': SustainableDevelopment,
  'Química teórica y computacional': TheoreticalChemistry,
  // YTLC
  'Education technology & AI': EdTechAI,
  'English-Medium Instruction': EnglishMedium,
  'English for specific purposes': EnglishSpecificPurposes,
  'Pedagogy, teacher and teacher education': PedagogyTeaching,
  'Sociolinguistics/Language and Culture': SociolinguisticsCulture,
  'Language Assessment': LanguageAssessment,
};

export const RESEARCH_LINE_MOTIFS = MOTIFS;

/** Pause decorative motion when its actual animated element is outside the viewport. */
export function useBackdropMotionVisibility<T extends HTMLElement | SVGSVGElement>(
  ref: RefObject<T | null>,
  { enabled = true, transform = false }: { enabled?: boolean; transform?: boolean } = {},
) {
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let intersects = false;
    element.dataset.backgroundMotion = 'true';

    const sync = () => {
      const running = intersects && !reducedMotion.matches && document.visibilityState === 'visible';
      element.dataset.motionPaused = String(!running);
      if (transform) element.style.willChange = running ? 'transform' : 'auto';
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      intersects = entry.isIntersecting;
      sync();
    });
    if (observer) observer.observe(element);
    else intersects = true;
    sync();
    reducedMotion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer?.disconnect();
      reducedMotion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      if (transform) element.style.removeProperty('will-change');
    };
  }, [enabled, ref, transform]);
}
/** Motivo decorativo de una línea. Es puramente visual: no recibe foco ni se anuncia. */
export function ResearchLineBackdrop({ researchLine }: { researchLine: OfficialResearchLine }) {
  const backdrop = useRef<SVGSVGElement>(null);
  useBackdropMotionVisibility(backdrop);
  const Motif = MOTIFS[researchLine];
  if (!Motif) return null;
  return (
    <svg
      ref={backdrop}
      className="featured-paper-backdrop research-line-backdrop"
      data-background-motion="true"
      data-motion-paused="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <Motif />
    </svg>
  );
}

export const RESEARCH_LINES_WITH_MOTIF = Object.keys(MOTIFS) as OfficialResearchLine[];

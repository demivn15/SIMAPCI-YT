import { useEffect, useRef } from 'react';
import { N_NODES, SCHOOL_GRAPH_COLORS, getSchoolGraphs, type SchoolCode } from './schoolGraphs';

/**
 * Fondo de grafo persistente.
 *
 * Un único grafo de 72 nodos. Al cambiar `school`, cada nodo viaja hacia su
 * posición en el grafo de la nueva escuela con suavizado exponencial y un
 * retraso escalonado de izquierda a derecha (ola). Como el movimiento parte de
 * la posición ACTUAL, no existen saltos aunque se cambie de escuela a mitad de
 * una transición (por ejemplo al tocar la barra de escuelas varias veces).
 * Los trazos del grafo anterior se desvanecen y los del nuevo aparecen; el
 * color se interpola entre los dos colores de escuela.
 *
 * El grafo se coloca en PÍXELES: centrado en la mascota (anchorX/anchorY como
 * fracción del ancho/alto del contenedor) y escalado para caber en pantalla sin
 * recortarse, sea cual sea la proporción. Se recalcula al redimensionar.
 *
 * Sin estado de React durante la animación: un solo requestAnimationFrame que
 * escribe unos pocos atributos SVG por cuadro. Se pausa fuera de pantalla, con
 * la pestaña oculta y respeta prefers-reduced-motion (cambia sin animar).
 */

interface Props {
  school: SchoolCode;
  className?: string;
  active?: boolean;
  pauseWhenSettled?: boolean;
  /** Centro del grafo en escritorio, como fracción del contenedor (donde está la mascota). */
  anchorX?: number;
  anchorY?: number;
}

const SET_COUNT = 3; // grafos de trazos visibles a la vez (actual + 2 que se desvanecen)

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function SchoolGraphBackdrop({ school, className, active = true, pauseWhenSettled = false, anchorX = 0.78, anchorY = 0.52 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const edgeRefs = useRef<(SVGPathElement | null)[]>([]);
  const bigRef = useRef<SVGPathElement>(null);
  const smallRef = useRef<SVGPathElement>(null);
  const targetRef = useRef<SchoolCode>(school);
  const anchorRef = useRef({ x: anchorX, y: anchorY });
  const wakeRef = useRef<() => void>(() => {});
  const sleepRef = useRef<() => void>(() => {});
  const relayoutRef = useRef<() => void>(() => {});
  const activeRef = useRef(active);

  anchorRef.current = { x: anchorX, y: anchorY };
  activeRef.current = active;

  // El cambio de escuela solo actualiza el objetivo y despierta el bucle.
  useEffect(() => {
    targetRef.current = school;
    wakeRef.current();
  }, [school]);

  useEffect(() => {
    if (active) wakeRef.current();
    else sleepRef.current();
  }, [active]);

  useEffect(() => {
    relayoutRef.current();
    wakeRef.current();
  }, [anchorX, anchorY]);

  useEffect(() => {
    const svg = svgRef.current;
    const big = bigRef.current;
    const small = smallRef.current;
    if (!svg || !big || !small) return;

    const graphs = getSchoolGraphs();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- colocación en píxeles ----
    let W = 1, H = 1;
    const targets: Record<string, Float32Array> = {};
    let float = 5;

    const place = (code: SchoolCode): Float32Array => {
      const g = graphs[code];
      const mobile = W < 760;
      const ax = (mobile ? 0.5 : anchorRef.current.x) * W;
      const ay = (mobile ? 0.58 : anchorRef.current.y) * H;
      // espacio disponible alrededor del ancla sin salirse de la pantalla
      const availW = mobile ? W * 0.94 : 2 * Math.min(ax - W * 0.3, W - ax - W * 0.015);
      const availH = mobile ? H * 0.5 : H * 0.9;
      const s = Math.max(40, Math.min(availW / (2 * g.halfW), availH / (2 * g.halfH)));
      const out = new Float32Array(N_NODES * 2);
      for (let i = 0; i < N_NODES; i++) {
        out[i * 2] = ax + g.points[i * 2] * s;
        out[i * 2 + 1] = ay + g.points[i * 2 + 1] * s;
      }
      return out;
    };

    const relayout = () => {
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const first = W === 1 && H === 1;
      W = r.width;
      H = r.height;
      svg.setAttribute('viewBox', `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`);
      for (const c of Object.keys(graphs)) targets[c] = place(c as SchoolCode);
      const unit = Math.min(W, H);
      const dot = Math.max(5, unit * 0.0105);
      small.setAttribute('stroke-width', dot.toFixed(1));
      big.setAttribute('stroke-width', (dot * 1.9).toFixed(1));
      for (const el of edgeRefs.current) el?.setAttribute('stroke-width', Math.max(1.3, unit * 0.0024).toFixed(2));
      float = Math.max(3, unit * 0.007);
      if (first) pos.set(targets[targetRef.current]);
    };
    relayoutRef.current = relayout;

    const pos = new Float32Array(N_NODES * 2);
    const rate = new Float32Array(N_NODES);
    const phase = new Float32Array(N_NODES);
    for (let i = 0; i < N_NODES; i++) {
      // ola de izquierda (más rápido) a derecha (más lento)
      rate[i] = 5.4 - (i / (N_NODES - 1)) * 2.8;
      phase[i] = i * 1.618;
    }
    relayout();

    // conjuntos de trazos: cada uno es un grafo con su opacidad
    type EdgeSet = { code: SchoolCode; alpha: number; goal: number };
    const sets: EdgeSet[] = [{ code: targetRef.current, alpha: 1, goal: 1 }];
    let lastTarget = targetRef.current;
    const color = hexToRgb(SCHOOL_GRAPH_COLORS[lastTarget]);

    let raf = 0;
    let last = 0;
    let visible = true;
    let running = false;

    const px = new Float32Array(N_NODES);
    const py = new Float32Array(N_NODES);
    // Each node can occur in many edges. Serialize its identical coordinates
    // once per frame, preserving the original SVG paths and graph movement.
    const pointText = new Array<string>(N_NODES);

    const render = (t: number, dt: number) => {
      const target = targetRef.current;
      if (target !== lastTarget) {
        lastTarget = target;
        for (const s of sets) s.goal = 0;
        const existing = sets.find((s) => s.code === target);
        if (existing) existing.goal = 1;
        else sets.push({ code: target, alpha: 0, goal: 1 });
        while (sets.length > SET_COUNT) sets.shift();
      }

      const tp = targets[target];
      let moving = false;
      for (let i = 0; i < N_NODES; i++) {
        const k = reduce ? 1 : 1 - Math.exp(-rate[i] * dt);
        const dx = tp[i * 2] - pos[i * 2];
        const dy = tp[i * 2 + 1] - pos[i * 2 + 1];
        pos[i * 2] += dx * k;
        pos[i * 2 + 1] += dy * k;
        if (Math.abs(dx) + Math.abs(dy) > 0.15) moving = true;
      }

      // color
      const goalRgb = hexToRgb(SCHOOL_GRAPH_COLORS[target]);
      const ck = reduce ? 1 : 1 - Math.exp(-3.5 * dt);
      for (let c = 0; c < 3; c++) color[c] += (goalRgb[c] - color[c]) * ck;
      svg.style.color = `rgb(${color[0] | 0},${color[1] | 0},${color[2] | 0})`;

      // posiciones de dibujo (con leve flotación si no hay reducción de movimiento)
      for (let i = 0; i < N_NODES; i++) {
        px[i] = pos[i * 2] + (reduce || pauseWhenSettled ? 0 : Math.sin(t * 0.0006 + phase[i]) * float);
        py[i] = pos[i * 2 + 1] + (reduce || pauseWhenSettled ? 0 : Math.cos(t * 0.00052 + phase[i] * 1.3) * float);
        pointText[i] = `${px[i].toFixed(1)} ${py[i].toFixed(1)}`;
      }

      // trazos
      const ak = reduce ? 1 : 1 - Math.exp(-3.2 * dt);
      for (let s = 0; s < SET_COUNT; s++) {
        const el = edgeRefs.current[s];
        if (!el) continue;
        const set = sets[s];
        if (!set) {
          el.setAttribute('d', '');
          continue;
        }
        set.alpha += (set.goal - set.alpha) * ak;
        if (set.goal === 0 && set.alpha < 0.02) set.alpha = 0;
        const e = graphs[set.code].edges;
        let d = '';
        for (let j = 0; j < e.length; j += 2) {
          const a = e[j], b = e[j + 1];
          d += `M${pointText[a]}L${pointText[b]}`;
        }
        el.setAttribute('d', set.alpha > 0 ? d : '');
        el.style.opacity = String(set.alpha * 0.7);
      }
      for (let s = sets.length - 1; s >= 0; s--) if (sets[s].goal === 0 && sets[s].alpha === 0) sets.splice(s, 1);

      // nodos: puntos como segmentos de longitud cero con extremos redondeados
      let dBig = '';
      let dSmall = '';
      for (let i = 0; i < N_NODES; i++) {
        const seg = `M${pointText[i]}h0`;
        if (i % 6 === 0) dBig += seg;
        else dSmall += seg;
      }
      big.setAttribute('d', dBig);
      small.setAttribute('d', dSmall);

      return { settled: !moving && sets.length === 1 && sets[0].alpha > 0.995 };
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) {
        running = false;
        return;
      }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const { settled } = render(now, dt);
      // con movimiento reducido y ya asentado, no hace falta seguir dibujando
      if ((reduce || pauseWhenSettled) && settled) {
        running = false;
        last = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (running || !visible || !activeRef.current) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    wakeRef.current = wake;
    const sleep = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      last = 0;
    };
    sleepRef.current = sleep;

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) wake();
      },
      { threshold: 0 },
    );
    io.observe(svg);
    const ro = new ResizeObserver(() => {
      relayout();
      wake();
    });
    ro.observe(svg);
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener('visibilitychange', onVis);
    wake();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      wakeRef.current = () => {};
      sleepRef.current = () => {};
      relayoutRef.current = () => {};
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      className={className ?? 'school-graph-backdrop'}
      viewBox="0 0 1600 900"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      style={{ color: SCHOOL_GRAPH_COLORS[school] }}
    >
      {Array.from({ length: SET_COUNT }, (_, i) => (
        <path
          key={i}
          ref={(el) => {
            edgeRefs.current[i] = el;
          }}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ))}
      <path ref={smallRef} fill="none" stroke="currentColor" strokeWidth={8} strokeLinecap="round" opacity={0.75} />
      <path ref={bigRef} fill="none" stroke="currentColor" strokeWidth={15} strokeLinecap="round" opacity={0.9} />
    </svg>
  );
}

export default SchoolGraphBackdrop;

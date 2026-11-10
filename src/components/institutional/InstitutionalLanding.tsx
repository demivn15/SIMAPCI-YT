import React, { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cubicBezier, motion, MotionValue, useMotionValue, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { ArrowDown } from 'lucide-react';
import { getSchoolDisplayCode, SCHOOLS, SchoolConfig } from '../../constants/schools';
import { enableNearbySchoolMascotPrefetch, ensureFloatingSchoolLogosDecoded, ensurePrioritySchoolMascotsDecoded, SCHOOL_LOGOS } from '../../assets/schoolLogos';
import { BASE_MASCOT } from '../../assets/schoolMascots';
import { LoginSchoolEmblem } from '../auth/LoginSchoolEmblem';
import { EcmcLogo } from '../../assets/EcmcLogo';
import { useMascotHandoff } from './mascotHandoff';
import type { MascotHandoff } from './mascotHandoff';
import './MascotHandoff.css';
import './TouchResearchStage.css';
import { useMotionPreference } from './useMotionPreference';

const LazyResearchStage = lazy(() => import('./ResearchStage').then(({ ResearchStage }) => ({ default: ResearchStage })));

export type MobileHandoffLogo = {
  element: HTMLSpanElement;
  sourceX: MotionValue<number>;
  sourceY: MotionValue<number>;
  sourceSize: MotionValue<number>;
};

function SchoolStageFallback({ onSelect, touchLayout }: { onSelect: (school: SchoolConfig) => void; touchLayout: boolean }) {
  const trackHeight = touchLayout ? '700svh' : 'calc(100svh - var(--landing-header-height) + 910svh)';
  return <div id="escuelas" className="institutional-school-stage-fallback" style={{ height: trackHeight }} aria-label="Escuelas disponibles">
    {SCHOOLS.map((school) => <section key={school.code} className="institutional-school-stage-fallback-card" style={{ '--school-accent': school.accent } as React.CSSProperties}>
      <img src={SCHOOL_LOGOS[school.code]} width={72} height={72} alt="" />
      <p>{getSchoolDisplayCode(school.code)}</p>
      <h2>{school.name}</h2>
      <button type="button" onClick={() => onSelect(school)}>Ver investigaciones y proyectos <span aria-hidden="true">→</span></button>
    </section>)}
  </div>;
}

const INTRO_TIMING_MS = {
  intro: 800,
  words: 600,
  logoFormation: 200,
  pageTransition: 800,
  logoTravel: 600,
  curtainRetraction: 600,
  contentStart: 1150,
  contentStagger: 70,
  emblemsStart: 0,
  emblemStagger: 50,
  total: 800 + 800,
  reducedFade: 200,
} as const;

const landingTimingStyles = {
  '--yt-blue': '#24618e',
  '--landing-intro-words-ms': `${INTRO_TIMING_MS.words}ms`,
  '--landing-logo-form-ms': `${INTRO_TIMING_MS.logoFormation}ms`,
  '--landing-transition-ms': `${INTRO_TIMING_MS.pageTransition}ms`,
  '--landing-logo-travel-ms': `${INTRO_TIMING_MS.logoTravel}ms`,
  '--landing-curtain-ms': `${INTRO_TIMING_MS.curtainRetraction}ms`,
  '--landing-content-start-ms': `${INTRO_TIMING_MS.contentStart}ms`,
  '--landing-content-stagger-ms': `${INTRO_TIMING_MS.contentStagger}ms`,
  '--landing-emblems-start-ms': `${INTRO_TIMING_MS.emblemsStart}ms`,
  '--landing-emblem-stagger-ms': `${INTRO_TIMING_MS.emblemStagger}ms`,
  '--landing-total-ms': `${INTRO_TIMING_MS.total}ms`,
};

const INTRO_STORAGE_KEY = 'simapc-institutional-intro-started';
let introStartedInMemory = false;

const FOOTER_LINK_GROUPS = [
  {
    title: 'Estudiantes',
    label: 'Enlaces para estudiantes',
    links: [
      { label: 'Moodle Pregrado', href: 'https://eva.yachaytech.edu.ec/login/index.php' },
      { label: 'Biblioteca en línea', href: 'https://biblioteca.yachaytech.edu.ec/' },
    ],
  },
  {
    title: 'Yachay Tech',
    label: 'Enlaces de Yachay Tech',
    links: [
      { label: 'Folleto en español', href: 'https://yachaytech.edu.ec/wp-content/uploads/2026/01/FOLLETO-YT-2026_compressed.pdf' },
      { label: 'English brochure', href: 'https://yachaytech.edu.ec/wp-content/uploads/2025/03/Yachay-Tech-Brochure-2025.pdf' },
      { label: 'Acerca de', href: 'https://yachaytech.edu.ec/acerca-de/' },
      { label: 'Investigación', href: 'https://yachaytech.edu.ec/investigacion/' },
      { label: 'Noticias', href: 'https://yachaytech.edu.ec/noticias/' },
    ],
  },
] as const;

const SOCIAL_LINKS = [
  { label: 'Facebook', shortLabel: 'f', href: 'https://www.facebook.com/universidadyachaytech/' },
  { label: 'X', shortLabel: 'X', href: 'https://x.com/UniYachayTech' },
  { label: 'Instagram', shortLabel: 'ig', href: 'https://www.instagram.com/uniyachaytech/' },
  { label: 'YouTube', shortLabel: '▶', href: 'https://www.youtube.com/user/YachayTech/videos' },
  { label: 'LinkedIn', shortLabel: 'in', href: 'https://www.linkedin.com/company/uni-yachay-tech/' },
  { label: 'TikTok', shortLabel: '♪', href: 'https://www.tiktok.com/@uniyachaytech' },
] as const;

type IntroPhase = 'intro' | 'logo' | 'transition' | 'reduced' | 'done';

function markIntroStarted() {
  introStartedInMemory = true;
  try {
    window.sessionStorage.setItem(INTRO_STORAGE_KEY, 'started');
  } catch {
    // The module-level flag keeps this tab from replaying the intro when storage is blocked.
  }
}

function getInitialPhase(replayIntro: boolean): IntroPhase {
  // The startup shell handles the first page load. Returning from the portal
  // explicitly replays the intro even when that visit is already remembered.
  if (!replayIntro) {
    const startup = window as Window & { __SIMAPC_STARTUP_END_AT?: number };
    if (typeof startup.__SIMAPC_STARTUP_END_AT === 'number') {
      markIntroStarted();
      return 'done';
    }

    try {
      if (window.sessionStorage.getItem(INTRO_STORAGE_KEY) === 'started') return 'done';
    } catch {
      if (introStartedInMemory) return 'done';
    }

    if (introStartedInMemory) return 'done';
  }
  let reducedMotion = false;
  try {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    // Continue with the normal intro when matchMedia is unavailable.
  }

  markIntroStarted();
  return reducedMotion ? 'reduced' : 'intro';
}

const emblemPositions = [
  { left: '68%', top: '15%', size: 150, rotation: '-17deg', parallax: 0.035, floatDelay: '0s' },
  { left: '87%', top: '18%', size: 138, rotation: '12deg', parallax: 0.055, floatDelay: '-1.1s' },
  { left: '72%', top: '42%', size: 158, rotation: '-9deg', parallax: 0.03, floatDelay: '-2.2s' },
  { left: '91%', top: '46%', size: 144, rotation: '15deg', parallax: 0.05, floatDelay: '-3.3s' },
  { left: '68%', top: '70%', size: 148, rotation: '11deg', parallax: 0.045, floatDelay: '-4.4s' },
  { left: '86%', top: '74%', size: 138, rotation: '-13deg', parallax: 0.06, floatDelay: '-5.5s' },
  { left: '78%', top: '91%', size: 130, rotation: '8deg', parallax: 0.04, floatDelay: '-6.1s' },
] as const;

function LandingEmblem({ school, size }: { school: SchoolConfig; size: number }) {
  return (
    <span
      className="institutional-landing-emblem-image"
      style={{ width: size, height: size, '--school-accent': school.accent } as React.CSSProperties}
    >
      {school.code === 'ECMC'
        ? <EcmcLogo className="institutional-landing-emblem-ecmc" size={size * .76} variant="color" />
        : <LoginSchoolEmblem school={school} size={size} />}
    </span>
  );
}

const handoffEase = cubicBezier(.22, 1, .36, 1);

function DesktopFloatingLandingEmblem({ school, index, visible, scrollY, reducedMotion, touchLayout, handoff }: {
  school: SchoolConfig;
  index: number;
  visible: boolean;
  scrollY: MotionValue<number>;
  reducedMotion: boolean;
  touchLayout: boolean;
  handoff: MascotHandoff;
}) {
  const position = emblemPositions[index];
  const anchorRef = useRef<HTMLSpanElement>(null);
  const sourceX = useMotionValue(0);
  const sourceY = useMotionValue(0);
  const sourceSize = useMotionValue<number>(position.size);
  // Let the logos drift toward the mascot, then fade while they are still apart.
  // The constellation takes over the focal point instead of a stack of logo tiles.
  const travelAmount = touchLayout ? .28 : .38;
  const travel = useTransform(handoff.progress, [.02, .76], [0, travelAmount], { ease: handoffEase });
  const angle = parseFloat(position.rotation) * Math.PI / 180;
  const travelAt = (progress: number) => travelAmount * handoffEase(Math.min(1, Math.max(0, (progress - .02) / .74)));
  // Subscribe after arrival is resolved, avoiding a stale travel value on reverse scroll.
  const positionInputs = [handoff.progress, handoff.targetX, handoff.targetY, sourceX, sourceY];
  // The enclosing reveal keeps its original rotation; compensate its coordinates
  // so all seven centers still arrive at the exact same point in the stage.
  const x = useTransform<number, number>(positionInputs, ([progress, targetX, targetY, originX, originY]) => {
    if (reducedMotion) return 0;
    const dx = targetX - originX;
    const dy = scrollY.get() + targetY - originY;
    return (dx * Math.cos(angle) + dy * Math.sin(angle)) * travelAt(progress);
  });
  const y = useTransform<number, number>(positionInputs, ([progress, targetX, targetY, originX, originY]) => {
    if (reducedMotion) return 0;
    const amount = travelAt(progress);
    const dx = targetX - originX;
    const dy = scrollY.get() + targetY - originY;
    return (-dx * Math.sin(angle) + dy * Math.cos(angle)) * amount;
  });
  const scale = useTransform(() => reducedMotion ? 1 : 1 + (40 / sourceSize.get() - 1) * travel.get());
  const rotate = useTransform(() => reducedMotion ? 0 : -parseFloat(position.rotation) * travel.get());
  const opacity = useTransform(handoff.progress, touchLayout ? [0, .08, .25, .4] : [0, .58, .72, .8], [1, 1, .35, 0]);

  useEffect(() => {
    const anchor = anchorRef.current;
    const overlay = anchor?.parentElement;
    const root = overlay?.offsetParent as HTMLElement | null;
    if (!anchor || !overlay || !root) return;
    const measure = () => {
      const rootRect = root.getBoundingClientRect();
      sourceX.set(rootRect.left + overlay.offsetLeft + anchor.offsetLeft);
      sourceY.set(rootRect.top + window.scrollY + overlay.offsetTop + anchor.offsetTop);
      sourceSize.set(anchor.offsetWidth || position.size);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(overlay);
    observer.observe(anchor);
    measure();
    return () => {
      observer.disconnect();
    };
  }, [position.size, sourceSize, sourceX, sourceY]);

  return (
    <span
      ref={anchorRef}
      className={`institutional-landing-hero-emblem ${visible ? 'is-visible' : ''}`}
      data-school={school.code}
      style={{
        left: position.left,
        top: position.top,
        '--emblem-rotation': position.rotation,
        '--emblem-size': `${position.size}px`,
        '--float-delay': position.floatDelay,
        '--entry-x': index % 2 === 0 ? '42px' : '-42px',
        '--entry-rotation': index % 2 === 0 ? '13deg' : '-13deg',
        '--arrival-delay': `${index * 55}ms`,
      } as React.CSSProperties}
    >
      <motion.span className="institutional-landing-hero-emblem-parallax" style={{ x, y, scale, rotate, opacity: reducedMotion ? 1 : opacity }}>
        <span className={`institutional-landing-hero-emblem-float ${visible ? 'is-floating' : ''}`}>
          <LandingEmblem school={school} size={position.size} />
        </span>
      </motion.span>
    </span>
  );
}

function MobileFloatingLandingEmblem({ school, index, visible, scrollY, reducedMotion, handoff, handoffLogos }: {
  school: SchoolConfig;
  index: number;
  visible: boolean;
  scrollY: MotionValue<number>;
  reducedMotion: boolean;
  handoff: MascotHandoff;
  handoffLogos: Map<SchoolConfig['code'], MobileHandoffLogo>;
}) {
  const position = emblemPositions[index];
  const anchorRef = useRef<HTMLSpanElement>(null);
  const sourceX = useMotionValue(0);
  const sourceY = useMotionValue(0);
  const sourceSize = useMotionValue<number>(position.size);
  const angle = parseFloat(position.rotation) * Math.PI / 180;
  const logoDelay = index * (40 / 900);
  const transform = useTransform<number, string>([handoff.progress, handoff.targetX, handoff.targetY, sourceX, sourceY, scrollY], ([progress, targetX, targetY, originX, originY, pageY]) => {
    if (reducedMotion) return 'none';
    const travel = handoffEase(Math.min(1, Math.max(0, (progress - logoDelay) / (2 / 3 - logoDelay))));
    const dx = targetX - originX;
    const dy = targetY - originY;
    const translateX = (dx * Math.cos(angle) + dy * Math.sin(angle)) * travel + pageY * Math.sin(angle);
    const translateY = (-dx * Math.sin(angle) + dy * Math.cos(angle)) * travel + pageY * Math.cos(angle);
    const scale = 1 - .5 * handoffEase(Math.min(1, Math.max(0, (travel - .6) / .4)));
    const rotation = -parseFloat(position.rotation) * travel;
    return `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotation}deg) scale(${scale})`;
  });
  const opacity = useTransform(handoff.progress, (progress) => {
    if (reducedMotion) return 1 - Math.min(1, Math.max(0, progress));
    const travel = handoffEase(Math.min(1, Math.max(0, (progress - logoDelay) / (2 / 3 - logoDelay))));
    return 1 - handoffEase(Math.min(1, Math.max(0, (travel - .6) / .4)));
  });

  useEffect(() => {
    const anchor = anchorRef.current;
    const overlay = anchor?.parentElement;
    if (!anchor || !overlay) return;
    const measure = () => {
      const rect = anchor.getBoundingClientRect();
      handoffLogos.set(school.code, { element: anchor, sourceX, sourceY, sourceSize });
      sourceX.set(rect.left + rect.width / 2);
      sourceY.set(rect.top + window.scrollY + rect.height / 2);
      sourceSize.set(rect.width || position.size);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(overlay);
    observer.observe(anchor);
    measure();
    return () => {
      observer.disconnect();
      if (handoffLogos.get(school.code)?.element === anchor) handoffLogos.delete(school.code);
    };
  }, [handoffLogos, position.size, school.code, sourceSize, sourceX, sourceY]);

  return <span ref={anchorRef} className={`institutional-landing-hero-emblem ${visible ? 'is-visible' : ''}`} data-school={school.code}
    style={{ left: position.left, top: position.top, '--emblem-rotation': position.rotation, '--emblem-size': `${position.size}px`, '--float-delay': position.floatDelay, '--entry-x': index % 2 === 0 ? '42px' : '-42px', '--entry-rotation': index % 2 === 0 ? '13deg' : '-13deg', '--arrival-delay': `${index * 55}ms` } as React.CSSProperties}>
    <motion.span className="institutional-landing-hero-emblem-parallax" style={{ transform, opacity }}>
      <span className={`institutional-landing-hero-emblem-float ${visible ? 'is-floating' : ''}`}><LandingEmblem school={school} size={position.size} /></span>
    </motion.span>
  </span>;
}

function FloatingLandingEmblem(props: {
  school: SchoolConfig;
  index: number;
  visible: boolean;
  scrollY: MotionValue<number>;
  reducedMotion: boolean;
  touchLayout: boolean;
  mobileTransition: boolean;
  handoff: MascotHandoff;
  handoffLogos: Map<SchoolConfig['code'], MobileHandoffLogo>;
}) {
  if (props.mobileTransition) return <MobileFloatingLandingEmblem {...props} />;
  return <DesktopFloatingLandingEmblem school={props.school} index={props.index} visible={props.visible} scrollY={props.scrollY} reducedMotion={props.reducedMotion} touchLayout={props.touchLayout} handoff={props.handoff} />;
}

// Start the one scroll observer after the first paint, so its initial geometry
// read does not force layout inside the intro's first animation frame.
function LandingScrollDriver({ value }: { value: MotionValue<number> }) {
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (latest) => value.set(latest));
  useEffect(() => { value.set(scrollY.get()); }, [scrollY, value]);
  return null;
}

export function InstitutionalLanding({ onSelect, replayIntroOnEntry = false }: {
  onSelect: (school: SchoolConfig) => void;
  replayIntroOnEntry?: boolean;
}) {
  const replayIntro = useRef(replayIntroOnEntry).current;
  const [phase, setPhase] = useState<IntroPhase>(() => getInitialPhase(replayIntro));
  const introVisible = phase === 'intro' || phase === 'logo' || phase === 'transition';
  const [contentVisible, setContentVisible] = useState(phase === 'done' || phase === 'reduced');
  const [visibleEmblems, setVisibleEmblems] = useState<boolean[]>(() =>
    SCHOOLS.map(() => phase === 'done' || phase === 'reduced'),
  );
  const [logosReady, setLogosReady] = useState(false);
  const reducedMotion = useMotionPreference();
  const scrollY = useMotionValue(replayIntro ? 0 : window.scrollY);
  const handoff = useMascotHandoff();
  const [scrollReady, setScrollReady] = useState(false);
  const [touchLayout, setTouchLayout] = useState(() => window.matchMedia('(pointer: coarse), (max-width: 1024px)').matches);
  const [mobileTransition, setMobileTransition] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const handoffLogos = useRef(new Map<SchoolConfig['code'], MobileHandoffLogo>());
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse), (max-width: 1024px)');
    const change = () => setTouchLayout(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    const change = () => setMobileTransition(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  const rootRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const emblemsRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const introTimersRef = useRef<number[]>([]);
  const introStartFrame = useRef(0);
  const introActiveRef = useRef(phase === 'intro');
  const introPhaseRef = useRef(phase);
  introPhaseRef.current = phase;

  useLayoutEffect(() => {
    if (!replayIntro) return;
    // A new welcome scene has progress zero. Do not restore the portal's scroll
    // position into it, which would start the mascot handoff behind the logos.
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const resetScroll = () => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      scrollY.set(0);
    };
    handoff.progress.set(0);
    resetScroll();
    // History traversal can restore its scroll after React's layout effects.
    const frame = requestAnimationFrame(resetScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.history.scrollRestoration = previousRestoration;
    };
  }, [handoff.progress, replayIntro, scrollY]);

  useLayoutEffect(() => {
    if (!replayIntro || !introVisible) return;
    // Keep gestures and browser scroll restoration from moving the welcome
    // scene underneath the return intro. Normal scrolling resumes at its end.
    const root = rootRef.current;
    const blockGesture = (event: Event) => event.preventDefault();
    const holdScroll = () => {
      if (window.scrollY !== 0) window.scrollTo({ top: 0, behavior: 'instant' });
      scrollY.set(0);
    };
    root?.addEventListener('wheel', blockGesture, { passive: false, capture: true });
    root?.addEventListener('touchmove', blockGesture, { passive: false, capture: true });
    window.addEventListener('scroll', holdScroll, { passive: true });
    holdScroll();
    return () => {
      root?.removeEventListener('wheel', blockGesture, true);
      root?.removeEventListener('touchmove', blockGesture, true);
      window.removeEventListener('scroll', holdScroll);
    };
  }, [introVisible, replayIntro, scrollY]);

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setScrollReady(true));
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, []);

  useEffect(() => {
    let mounted = true;
    void ensureFloatingSchoolLogosDecoded().then((ready) => {
      if (mounted) {
        setLogosReady(ready);
        void ensurePrioritySchoolMascotsDecoded();
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // On phones the intro is long enough to warm the nearby mascots without
    // competing with the first school change. Desktop keeps its existing timing.
    if (logosReady && (mobileTransition || phase === 'done')) enableNearbySchoolMascotPrefetch();
  }, [phase, logosReady, mobileTransition]);

  useEffect(() => {
    if (!mobileTransition) return;
    let scheduled = false;
    let cancelled = false;
    let idleHandle: number | undefined;
    let fallbackTimer: number | undefined;
    const unsubscribe = handoff.progress.on('change', (progress) => {
      if (scheduled || progress < .98) return;
      scheduled = true;
      const warmSchoolPortal = () => {
        idleHandle = undefined;
        fallbackTimer = undefined;
        if (cancelled) return;
        void import('../../PortalApp')
          .then(({ preloadSchoolEntry }) => preloadSchoolEntry())
          .catch(() => {});
      };
      const idleWindow = window as Window & { requestIdleCallback?: typeof window.requestIdleCallback };
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback.call(window, warmSchoolPortal, { timeout: 1200 });
      } else {
        fallbackTimer = window.setTimeout(warmSchoolPortal, 250);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
      const idleWindow = window as Window & { cancelIdleCallback?: typeof window.cancelIdleCallback };
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.call(window, idleHandle);
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
    };
  }, [handoff.progress, mobileTransition]);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    const overlay = emblemsRef.current;
    if (!hero || !overlay) return;
    const measure = () => {
      // Static layout geometry only: scrolling updates motion values, not styles.
      const link = hero.querySelector<HTMLElement>('.institutional-landing-hero-link');
      const copy = link?.closest<HTMLElement>('.institutional-landing-hero-copy');
      const mobileWelcome = window.matchMedia('(max-width: 760px)').matches;
      const overlayTop = mobileWelcome && link && copy
        ? hero.offsetTop + copy.offsetTop + link.offsetTop + link.offsetHeight + 48
        : hero.offsetTop;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const overlayHeight = Math.max(0, hero.offsetTop + hero.offsetHeight - overlayTop);
      if (mobileWelcome) {
        // This absolute layer reserves no space in the page. Measure its real
        // height instead of stretching every logo and its FLIP coordinates.
        overlay.style.height = `${overlayHeight}px`;
        overlay.style.transform = `translate3d(${hero.offsetLeft}px, ${overlayTop}px, 0)`;
      } else {
        overlay.style.removeProperty('height');
        overlay.style.transform = `translate3d(${hero.offsetLeft}px, ${overlayTop}px, 0) scaleY(${overlayHeight / viewportHeight})`;
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(hero);
    const copy = hero.querySelector('.institutional-landing-hero-copy');
    if (copy) observer.observe(copy);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const footer = footerRef.current;
    const hero = heroRef.current;
    const overlay = emblemsRef.current;
    if (!footer || !hero) return;
    if (!('IntersectionObserver' in window)) {
      footer.dataset.revealed = 'true';
      hero.dataset.inView = 'true';
      if (overlay) overlay.dataset.inView = 'true';
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === hero) {
          hero.dataset.inView = String(entry.isIntersecting);
          if (overlay) overlay.dataset.inView = String(entry.isIntersecting);
        }
        if (entry.target === footer && entry.isIntersecting) {
          footer.dataset.revealed = 'true';
          observer.unobserve(footer);
        }
      });
    }, { threshold: 0.04 });
    observer.observe(footer);
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const completeIntro = useCallback(() => {
    introActiveRef.current = false;
    cancelAnimationFrame(introStartFrame.current);
    introTimersRef.current.forEach(window.clearTimeout);
    introTimersRef.current = [];
    setPhase('done');
    setContentVisible(true);
    setVisibleEmblems(SCHOOLS.map(() => true));
  }, []);

  useEffect(() => {
    if (!mobileTransition || !replayIntro) return;
    let suspended = document.visibilityState === 'hidden';
    const suspend = () => { suspended = true; };
    const restore = () => {
      if (!suspended || document.visibilityState === 'hidden') return;
      suspended = false;
      if (introPhaseRef.current === 'done') return;
      // Timers and CSS animations can resume in a different order on Android.
      // A return intro that was backgrounded must reveal one complete welcome.
      completeIntro();
      handoff.progress.set(0);
      window.scrollTo({ top: 0, behavior: 'instant' });
      scrollY.set(0);
    };
    const visibility = () => document.visibilityState === 'hidden' ? suspend() : restore();
    window.addEventListener('pagehide', suspend);
    window.addEventListener('pageshow', restore);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pagehide', suspend);
      window.removeEventListener('pageshow', restore);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [completeIntro, handoff.progress, mobileTransition, replayIntro, scrollY]);

  useLayoutEffect(() => {
    if (phase === 'reduced') {
      const finishTimer = window.setTimeout(() => setPhase('done'), INTRO_TIMING_MS.reducedFade);
      return () => window.clearTimeout(finishTimer);
    }
    if (phase !== 'intro') return;

    introActiveRef.current = true;
    const timers: number[] = [];
    // Start with the first painted frame, not during a potentially slow initial commit.
    const firstFrame = requestAnimationFrame(() => {
      if (!introActiveRef.current) return;
      timers.push(window.setTimeout(() => setPhase('logo'), INTRO_TIMING_MS.words));
      timers.push(window.setTimeout(() => setPhase('transition'), INTRO_TIMING_MS.intro));
      timers.push(window.setTimeout(() => setContentVisible(true), INTRO_TIMING_MS.contentStart));
      timers.push(window.setTimeout(() => {
        introActiveRef.current = false;
        setPhase('done');
      }, INTRO_TIMING_MS.total));

      SCHOOLS.forEach((_, index) => {
        timers.push(window.setTimeout(() => {
          setVisibleEmblems((current) => current.map((visible, itemIndex) => itemIndex === index || visible));
        }, INTRO_TIMING_MS.emblemsStart + index * INTRO_TIMING_MS.emblemStagger));
      });
    });
    introStartFrame.current = firstFrame;

    introTimersRef.current = timers;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && introActiveRef.current) completeIntro();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(firstFrame);
      timers.forEach(window.clearTimeout);
      introTimersRef.current = [];
      window.removeEventListener('keydown', onKeyDown);
    };
  // The sequence starts once and its timers must survive the intermediate phases.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageClasses = [
    'institutional-landing',
    `is-${phase}`,
    contentVisible ? 'has-revealed-content' : '',
  ].filter(Boolean).join(' ');
  const revealStyle = (step: number) => ({
    '--reveal-delay': `${step * INTRO_TIMING_MS.contentStagger}ms`,
  } as React.CSSProperties);
  const handleSchoolsLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (replayIntro && introVisible) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!mobileTransition) return;
    event.preventDefault();
    event.stopPropagation();
    document.dispatchEvent(new Event('simapc-enter-schools'));
  };
  const welcomeOpacity = useTransform(handoff.progress, (progress) => {
    const handoffProgress = Math.max(0, Math.min(1, progress));
    if (reducedMotion) return 1 - handoffProgress;
    return 1 - Math.max(0, Math.min(1, (handoffProgress - .16) / .24));
  });
  const welcomeY = useTransform(handoff.progress, (progress) => reducedMotion ? 0 : -16 * handoffEase(Math.max(0, Math.min(1, progress))));
  const stageCanWarm = mobileTransition && logosReady && (phase === 'logo' || phase === 'transition');

  return (
    <main
      ref={rootRef}
      className={pageClasses}
      style={landingTimingStyles as React.CSSProperties}
      onClick={(event) => {
        if (!introVisible || (event.target instanceof Element && event.target.closest('button, a'))) return;
        completeIntro();
      }}
    >
      {scrollReady && !touchLayout && <LandingScrollDriver value={scrollY} />}
      <header className="institutional-landing-header" aria-label="Universidad Yachay Tech">
        <span className="institutional-landing-header-space">
          <a className="institutional-landing-header-link" href="#escuelas" onClick={handleSchoolsLinkClick}>
            Acceso institucional <ArrowDown aria-hidden="true" size={17} strokeWidth={2} />
          </a>
        </span>
        <img
          className="institutional-landing-brand-logo"
          src="./assets/yachay-logo-clean.svg"
          width={731}
          height={252}
          alt="Universidad Yachay Tech"
          draggable={false}
        />
      </header>

      {introVisible && (
        <div className="institutional-landing-curtain" aria-hidden="true">
          <div className="institutional-landing-intro-words">
            <span>UNIVERSIDAD</span>
            <span>YACHAY TECH</span>
            <small>SIMAPC</small>
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <button
          className="institutional-landing-skip"
          type="button"
          onClick={completeIntro}
        >
          Omitir intro <span aria-hidden="true">· Esc</span>
        </button>
      )}

      <section ref={heroRef} className="institutional-landing-hero" aria-labelledby="landing-title" data-assets-ready={logosReady} data-in-view="false">
        <div className="institutional-landing-mascot-scene" aria-hidden="true">
          <span className="institutional-landing-mascot-orbit institutional-landing-mascot-orbit-primary" />
          <span className="institutional-landing-mascot-orbit institutional-landing-mascot-orbit-secondary" />
          <img className="institutional-landing-desktop-mascot" src={BASE_MASCOT} width={768} height={768} alt="" decoding="async" draggable={false} />
        </div>
        <motion.div className="institutional-landing-hero-copy" style={mobileTransition ? { opacity: welcomeOpacity, y: welcomeY } : undefined}>
          <p className="institutional-landing-eyebrow landing-reveal" style={revealStyle(0)}>SIMAPC · Portal de investigación</p>
          <h1 id="landing-title" className="institutional-landing-title">
            <span className="institutional-landing-title-mask landing-reveal" style={revealStyle(1)}><span>La investigación</span></span>
            <span className="institutional-landing-title-mask landing-reveal" style={revealStyle(2)}><span className="institutional-landing-blue-word">de Yachay Tech</span></span>
          </h1>
          <p className="institutional-landing-subtitle landing-reveal" style={revealStyle(3)}>
            Publicaciones, proyectos y perfiles académicos de las siete escuelas.
          </p>
          <div className="institutional-landing-entry-guide landing-reveal" style={revealStyle(4)} aria-label="Formas de usar el portal">
            <div className="institutional-landing-entry-item">
              <strong>Consulta pública</strong>
              <span>Explora publicaciones, proyectos y docentes.</span>
            </div>
            <div className="institutional-landing-entry-item">
              <strong>Comunidad Yachay Tech</strong>
              <span>Elige tu escuela para iniciar sesión.</span>
            </div>
          </div>
          <a className="institutional-landing-hero-link landing-reveal" style={revealStyle(5)} href="#escuelas" onClick={handleSchoolsLinkClick}>
            Explorar las escuelas <ArrowDown aria-hidden="true" size={19} strokeWidth={2.2} />
          </a>
        </motion.div>
      </section>

      <div ref={emblemsRef} className="institutional-landing-hero-emblems mascot-handoff-logos" aria-hidden="true" data-in-view="false" data-assets-ready={logosReady}>
        {SCHOOLS.map((school, index) => (
          <FloatingLandingEmblem key={school.code} school={school} index={index} visible={logosReady && visibleEmblems[index]} scrollY={scrollY} reducedMotion={!!reducedMotion} touchLayout={touchLayout} mobileTransition={mobileTransition} handoff={handoff} handoffLogos={handoffLogos.current} />
        ))}
      </div>

      {phase === 'done' || stageCanWarm ? (
        <Suspense fallback={<SchoolStageFallback onSelect={onSelect} touchLayout={touchLayout} />}>
          <LazyResearchStage onSelect={onSelect} scrollY={scrollY} handoff={handoff} initialLogosReady={logosReady} mobileTransitionEnabled={mobileTransition} handoffLogos={handoffLogos.current} interactionEnabled={phase === 'done'} />
        </Suspense>
      ) : <SchoolStageFallback onSelect={onSelect} touchLayout={touchLayout} />}

      <footer ref={footerRef} className="institutional-landing-footer" data-revealed="false" aria-label="Enlaces institucionales">
        <div className="institutional-landing-footer-ribbon" aria-hidden="true">
          {SCHOOLS.map((school) => <span key={school.code} style={{ backgroundColor: school.accent }} />)}
        </div>
        <div className="institutional-landing-footer-content">
          <div className="institutional-landing-footer-brand">
            <img src="./assets/yachay-logo-clean.svg" width={731} height={252} alt="Universidad Yachay Tech" />
            <p>Producción científica y comunidad investigadora en un solo lugar.</p>
          </div>
          {FOOTER_LINK_GROUPS.map((group) => (
            <nav className="institutional-landing-footer-group" aria-label={group.label} key={group.title}>
              <h2>{group.title}</h2>
              <ul>{group.links.map((link) => (
                <li key={link.label}><a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a></li>
              ))}</ul>
            </nav>
          ))}
          <nav className="institutional-landing-footer-group institutional-landing-footer-social" aria-label="Redes sociales de Yachay Tech">
            <h2>Síguenos en redes</h2>
            <ul>{SOCIAL_LINKS.map((link) => (
              <li key={link.label}>
                <a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}>
                  <span aria-hidden="true">{link.shortLabel}</span>
                  <span>{link.label}</span>
                </a>
              </li>
            ))}</ul>
          </nav>
        </div>
        <div className="institutional-landing-footer-bottom">
          <span>SIMAPC · Sistema de Manejo de Producción Científica</span>
          <span>Universidad Yachay Tech</span>
        </div>
      </footer>
    </main>
  );
}

export { INTRO_TIMING_MS };

import type { SchoolConfig } from '../constants/schools';
import { SCHOOLS } from '../constants/schools';
import { BASE_MASCOT, SCHOOL_MASCOTS } from './schoolMascots';

const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/** The seven small marks required to reveal the welcome screen. */
export const SCHOOL_LOGOS: Record<SchoolConfig['code'], string> = {
  ECIAA: publicAsset('logos/ecaa.webp'),
  ECBI: publicAsset('logos/ecbi.webp'),
  ECFN: publicAsset('logos/ecfn.webp'),
  ECTEA: publicAsset('logos/ectea.webp'),
  ECMC: publicAsset('logos/ecmc.webp'),
  ECQI: publicAsset('logos/ecqi.webp'),
  YTLC: publicAsset('logos/ytlc.webp'),
};

type FetchPriority = 'high' | 'auto' | 'low';
const decodedImages = new Map<string, HTMLImageElement>();
const decodePromises = new Map<string, Promise<boolean>>();
let floatingLogosPromise: Promise<boolean> | undefined;
let priorityMascotsPromise: Promise<boolean> | undefined;
let idleHandle: number | undefined;
let fallbackTimer: number | undefined;
let mascotQueue: SchoolConfig['code'][] = [];
let nearbyMascotPrefetchEnabled = false;

function decodeImage(src: string, priority: FetchPriority = 'auto'): Promise<boolean> {
  if (decodedImages.has(src)) return Promise.resolve(true);
  const existing = decodePromises.get(src);
  if (existing) return existing;

  const promise = (async () => {
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = priority;
    image.src = src;
    try {
      await image.decode();
      decodedImages.set(src, image);
      return true;
    } catch {
      return false;
    } finally {
      decodePromises.delete(src);
    }
  })();
  decodePromises.set(src, promise);
  return promise;
}

export function ensureFloatingSchoolLogosDecoded(): Promise<boolean> {
  floatingLogosPromise ??= Promise.all(
    Object.values(SCHOOL_LOGOS).map((src) => decodeImage(src, 'high')),
  ).then((results) => results.every(Boolean));
  return floatingLogosPromise;
}

/** Kept as a compatibility alias for the logo-only gate used by school selectors. */
export const ensureSchoolLogosDecoded = ensureFloatingSchoolLogosDecoded;

export function isSchoolMascotDecoded(code: SchoolConfig['code']): boolean {
  return decodedImages.has(SCHOOL_MASCOTS[code]);
}

export function ensureSchoolMascotDecoded(code: SchoolConfig['code']): Promise<boolean> {
  return decodeImage(SCHOOL_MASCOTS[code], 'auto');
}

/** Start the base and ECIAA mascot while the intro and welcome screen are visible. */
export function ensurePrioritySchoolMascotsDecoded(): Promise<boolean> {
  priorityMascotsPromise ??= Promise.all([
    decodeImage(BASE_MASCOT, 'auto'),
    ensureSchoolMascotDecoded('ECIAA'),
  ]).then((results) => results.every(Boolean));
  return priorityMascotsPromise;
}

function scheduleNextMascot() {
  if (!nearbyMascotPrefetchEnabled || idleHandle !== undefined || fallbackTimer !== undefined || mascotQueue.length === 0) return;
  const run = () => {
    idleHandle = undefined;
    fallbackTimer = undefined;
    const next = mascotQueue.shift();
    if (!next) return;
    void decodeImage(SCHOOL_MASCOTS[next], 'low').finally(scheduleNextMascot);
  };
  if (typeof window === 'undefined') return;
  const idleWindow = window as unknown as { requestIdleCallback?: typeof window.requestIdleCallback };
  if (idleWindow.requestIdleCallback) {
    idleHandle = idleWindow.requestIdleCallback.call(window, run, { timeout: 1200 });
  } else {
    fallbackTimer = window.setTimeout(run, 350);
  }
}

/** Enable the background queue after the welcome is visible; active mascots can still load on demand. */
export function enableNearbySchoolMascotPrefetch() {
  nearbyMascotPrefetchEnabled = true;
  if (priorityMascotsPromise) {
    void priorityMascotsPromise.finally(scheduleNextMascot);
  } else {
    scheduleNextMascot();
  }
}

/** Prefetch nearby school mascots during idle time; active schools can still load on demand. */
export function scheduleNearbySchoolMascots(activeCode: SchoolConfig['code']) {
  if (typeof window === 'undefined') return;
  const idleWindow = window as unknown as { cancelIdleCallback?: typeof window.cancelIdleCallback };
  if (idleHandle !== undefined && idleWindow.cancelIdleCallback) {
    idleWindow.cancelIdleCallback.call(window, idleHandle);
    idleHandle = undefined;
  }
  if (fallbackTimer !== undefined) {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = undefined;
  }

  const activeIndex = SCHOOLS.findIndex((school) => school.code === activeCode);
  mascotQueue = SCHOOLS
    .map((school, index) => ({ school, index, distance: Math.abs(index - activeIndex) }))
    .filter(({ school }) => school.code !== 'ECIAA' && !isSchoolMascotDecoded(school.code))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .map(({ school }) => school.code);
  scheduleNextMascot();
}

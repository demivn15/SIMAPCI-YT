import type { SchoolConfig } from '../constants/schools';

const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

// Optimized derivatives live separately; originals in /public/mascot remain unchanged.
export const BASE_MASCOT = publicAsset('mascot-optimized/base.webp');

export const SCHOOL_MASCOTS: Record<SchoolConfig['code'], string> = {
  ECIAA: publicAsset('mascot-optimized/ecaa.webp'),
  ECBI: publicAsset('mascot-optimized/ecbi.webp'),
  ECFN: publicAsset('mascot-optimized/ecfn.webp'),
  ECTEA: publicAsset('mascot-optimized/ectea.webp'),
  ECMC: publicAsset('mascot-optimized/ecmc.webp'),
  ECQI: publicAsset('mascot-optimized/ecqi.webp'),
  YTLC: publicAsset('mascot-optimized/ytlc.webp'),
};

// The pose images share a 768px canvas, but their transparent top/bottom
// margins differ. These factors align their visible height to the base mascot.
export const SCHOOL_MASCOT_FRAME: Record<SchoolConfig['code'], { scale: number; offsetY: string }> = {
  ECIAA: { scale: .959, offsetY: '1.2%' },
  ECBI: { scale: .933, offsetY: '.96%' },
  ECFN: { scale: .913, offsetY: '1.09%' },
  ECTEA: { scale: .999, offsetY: '-.06%' },
  ECMC: { scale: .918, offsetY: '.85%' },
  ECQI: { scale: .911, offsetY: '1.21%' },
  YTLC: { scale: .99, offsetY: '-.43%' },
};

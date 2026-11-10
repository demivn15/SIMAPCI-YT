import type { SchoolCode } from '../constants/schools';

interface LoginSchoolLogo {
  src: string;
  width: number;
  height: number;
  viewBox: string;
}

const publicAsset = (name: string) => `${import.meta.env.BASE_URL}logos/login/${name}.webp`;

// Supplied originals, only resized and compressed. The viewBox fits their marks
// to the shared 3D frame without altering the source image or its proportions.
export const LOGIN_SCHOOL_LOGOS: Record<Exclude<SchoolCode, 'ECMC'>, LoginSchoolLogo> = {
  ECIAA: { src: publicAsset('ecaa'), width: 512, height: 512, viewBox: '123 62 266 354' },
  ECBI: { src: publicAsset('ecbi'), width: 512, height: 512, viewBox: '105 57 302 397' },
  ECFN: { src: publicAsset('ecfn'), width: 512, height: 512, viewBox: '23 32 466 426' },
  ECTEA: { src: publicAsset('ectea'), width: 512, height: 512, viewBox: '59 39 390 442' },
  ECQI: { src: publicAsset('ecqi'), width: 512, height: 382, viewBox: '105 13 302 357' },
  YTLC: { src: publicAsset('ytlc'), width: 512, height: 382, viewBox: '56 49 421 333' },
};

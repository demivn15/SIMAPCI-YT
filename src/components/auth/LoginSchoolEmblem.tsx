import React, { useId } from 'react';
import type { SchoolConfig } from '../../constants/schools';
import { LOGIN_SCHOOL_LOGOS } from '../../assets/loginSchoolLogos';
import { SchoolEmblem } from '../institutional/SchoolLogo';

/** The login's solid mark, using the supplied image as its silhouette. */
export function LoginSchoolEmblem({ school, size = 340 }: { school: SchoolConfig; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (school.code === 'ECMC') return <SchoolEmblem school={school} size={size} />;
  const logo = LOGIN_SCHOOL_LOGOS[school.code];
  const filterId = `login-logo-filter-${id}`;
  const maskId = `login-logo-mask-${id}`;
  return <svg className="login-school-emblem-svg" width={size} height={size} viewBox={logo.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs>
      <filter id={filterId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        {/* White becomes transparent only in the render; the original stays intact. */}
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -4 -4 -4 0 11.4" />
      </filter>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={logo.width} height={logo.height} style={{ maskType: 'alpha' }}>
        <image href={logo.src} x="0" y="0" width={logo.width} height={logo.height} preserveAspectRatio="none" filter={`url(#${filterId})`} />
      </mask>
    </defs>
    <rect x="0" y="0" width={logo.width} height={logo.height} fill="currentColor" mask={`url(#${maskId})`} />
  </svg>;
}

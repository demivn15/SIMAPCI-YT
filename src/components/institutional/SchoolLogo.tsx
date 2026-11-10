import React from 'react';
import { SchoolConfig } from '../../constants/schools';
import { EcmcLogo } from '../../assets/EcmcLogo';

export function SchoolLogo({ school, className = '', scale = 1 }: { school: SchoolConfig; className?: string; scale?: number }) {
  const { x, y } = school.logoCrop;
  return (
    <span className={`school-logo-crop ${className}`} role="img" aria-label={school.name} style={{ width: school.logoCrop.width * scale, height: school.logoCrop.height * scale }}>
      <img
        className="school-logo-sheet"
        src="./assets/school-logos.png"
        alt=""
        style={{ left: -x * scale, top: -y * scale, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </span>
  );
}

export function SchoolIconTile({ school, className = '', size = 112 }: { school: SchoolConfig; className?: string; size?: number }) {
  const { x, y } = school.iconTilePosition;
  const scale = size / 113;
  return (
    <span
      className={`school-icon-crop ${className}`}
      role="img"
      aria-label={`Logo de ${school.name}`}
      style={{ width: 113 * scale, height: 112 * scale }}
    >
      <img
        className="school-icon-sheet"
        src="./assets/school-icon-tiles.png"
        alt=""
        style={{ left: -x * scale, top: -y * scale, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </span>
  );
}

export function SchoolEmblem({ school, size = 260 }: { school: SchoolConfig; size?: number }) {
  if (school.code === 'ECMC') {
    return <EcmcLogo className="school-emblem-ecmc" size={size} variant="white" />;
  }

  return (
    <img
      className="school-emblem-svg"
      src={`./assets/school-emblems/${school.code}.svg`}
      alt={`Emblema de ${school.name}`}
      style={{ width: size, height: size }}
    />
  );
}

export function SchoolEmblemDepth({ school, size = 260 }: { school: SchoolConfig; size?: number }) {
  const image = `url("./assets/school-emblems/${school.code}.svg")`;
  return (
    <span
      className="school-emblem-depth"
      aria-hidden="true"
      style={{ width: size, height: size, maskImage: image, WebkitMaskImage: image }}
    />
  );
}

export function YachayLogo({ width = 136, className = '' }: { width?: number; className?: string }) {
  return (
    <img
      className={`yachay-logo ${className}`}
      src="./assets/yachay-logo-clean.svg"
      alt="Universidad Yachay Tech"
      style={{ width, height: 'auto' }}
    />
  );
}

export function YachaySymbol({ size = 48, className = '' }: { size?: number; className?: string }) {
  // Crop the emblem from the high-resolution university logo instead of the
  // older 219 × 96 raster, which looked soft in the sidebar.
  const scale = size / 234;
  return (
    <span
      className={`yachay-symbol-crop ${className}`}
      role="img"
      aria-label="Símbolo de la Universidad Yachay Tech"
      style={{ width: size, height: size }}
    >
      <img
        src="./assets/yachay-logo-clean.svg"
        alt=""
        aria-hidden="true"
        style={{ width: 731 * scale, height: 252 * scale, left: -489 * scale, top: -8 * scale }}
      />
    </span>
  );
}

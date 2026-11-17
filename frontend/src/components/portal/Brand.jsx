/**
 * Logos institucionales: Universidad Yachay Tech y ECMC.
 */

const YACHAY_LOGO = '/assets/yachay-logo-clean.svg';

export function YachayLogo({ width = 130 }) {
  return <img src={YACHAY_LOGO} alt="Universidad Yachay Tech" style={{ width, height: 'auto' }} />;
}

/** Solo el símbolo de Yachay Tech, recortado del logo completo (para el menú lateral). */
export function YachaySymbol({ size = 48 }) {
  const scale = size / 234;
  return (
    <span
      role="img"
      aria-label="Símbolo de la Universidad Yachay Tech"
      style={{ position: 'relative', display: 'inline-block', width: size, height: size, overflow: 'hidden', flexShrink: 0 }}
    >
      <img
        src={YACHAY_LOGO}
        alt=""
        style={{ position: 'absolute', maxWidth: 'none', width: 731 * scale, height: 252 * scale, left: -489 * scale, top: -8 * scale }}
      />
    </span>
  );
}

/** Logo de la ECMC: sigma y columna segmentada. */
export function EcmcLogo({ size = 340 }) {
  return (
    <svg width={size} height={(size * 110) / 100} viewBox="0 0 100 110" fill="none" aria-hidden="true">
      <g stroke="#EF4035" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 18H68M12 18 38 55M38 55H64M38 55 12 92M12 92H68" />
      </g>
      <rect x="80" y="10" width="11" height="16" rx="2" fill="#991B1B" />
      <rect x="80" y="32" width="11" height="16" rx="2" fill="#EF4035" />
      <rect x="80" y="54" width="11" height="20" rx="2" fill="#FCA5A5" />
      <rect x="80" y="80" width="11" height="20" rx="2" fill="#991B1B" />
    </svg>
  );
}

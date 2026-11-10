import React from 'react';

interface EcmcLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'color' | 'white' | 'dark';
  showText?: boolean;
  textSubtitle?: string;
}

/**
 * Logotipo Institucional de la Escuela de Ciencias Matemáticas y Computacionales (ECMC)
 * Identidad visual de la Escuela de Ciencias Matemáticas y Computacionales.
 * Fiel a la captura oficial 01 y 04 de especificación visual.
 */
export const EcmcLogo: React.FC<EcmcLogoProps> = ({
  className = '',
  size = 36,
  variant = 'color',
  showText = false,
  textSubtitle = 'PRODUCCIÓN CIENTÍFICA ECMC',
}) => {
  const mainRed = variant === 'white' ? '#FFFFFF' : '#EF4035';
  const darkRed = variant === 'white' ? 'rgba(255,255,255,0.7)' : '#991B1B';
  const lightRed = variant === 'white' ? 'rgba(255,255,255,0.45)' : '#FCA5A5';
  const midRed = variant === 'white' ? '#FFFFFF' : '#EF4035';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <svg
        width={size}
        height={typeof size === 'number' ? (size * 44) / 40 : size}
        viewBox="0 0 100 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-label="Logo Institucional ECMC Yachay Tech"
      >
        {/* Símbolo Sigma estilizado a la izquierda */}
        <g strokeLinecap="round" strokeLinejoin="round">
          {/* Barra superior con cap redondeado */}
          <path
            d="M 12 18 L 68 18"
            stroke={mainRed}
            strokeWidth="9"
          />
          {/* Diagonal superior hacia vértice medio */}
          <path
            d="M 12 18 L 38 55"
            stroke={mainRed}
            strokeWidth="9"
          />
          {/* Apéndice horizontal del vértice medio */}
          <path
            d="M 38 55 L 64 55"
            stroke={mainRed}
            strokeWidth="9"
          />
          {/* Diagonal inferior */}
          <path
            d="M 38 55 L 12 92"
            stroke={mainRed}
            strokeWidth="9"
          />
          {/* Barra inferior con cap redondeado */}
          <path
            d="M 12 92 L 68 92"
            stroke={mainRed}
            strokeWidth="9"
          />

          {/* Caps circulares en los extremos de la sigma */}
          <circle cx="68" cy="18" r="4.5" fill={mainRed} />
          <circle cx="64" cy="55" r="4.5" fill={mainRed} />
          <circle cx="68" cy="92" r="4.5" fill={mainRed} />
        </g>

        {/* Columna vertical segmentada a la derecha */}
        {/* Segmento 1: Superior (Rojo oscuro) */}
        <rect
          x="80"
          y="10"
          width="11"
          height="16"
          rx="2"
          fill={darkRed}
        />
        {/* Segmento 2: Medio-superior (Rojo principal) */}
        <rect
          x="80"
          y="32"
          width="11"
          height="16"
          rx="2"
          fill={midRed}
        />
        {/* Segmento 3: Medio-inferior (Rosa / Coral suave) */}
        <rect
          x="80"
          y="54"
          width="11"
          height="20"
          rx="2"
          fill={lightRed}
        />
        {/* Segmento 4: Inferior (Rojo oscuro) */}
        <rect
          x="80"
          y="80"
          width="11"
          height="20"
          rx="2"
          fill={darkRed}
        />
      </svg>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span
            className={`font-black tracking-tight text-lg ${
              variant === 'white' ? 'text-white' : 'text-neutral-900'
            }`}
          >
            SIMAPC
          </span>
          <span
            className={`text-[10px] font-semibold tracking-wider uppercase ${
              variant === 'white' ? 'text-white/80' : 'text-neutral-500'
            }`}
          >
            {textSubtitle}
          </span>
        </div>
      )}
    </div>
  );
};

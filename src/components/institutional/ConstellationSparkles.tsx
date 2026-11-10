import React from 'react';

/** Lightweight, transparent constellation accent for the mascot handoff. */
export function ConstellationSparkles({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor" stroke="currentColor">
        <g id="sparkle-1">
          <path d="M192 48Q192 64 208 64Q192 64 192 80Q192 64 176 64Q192 64 192 48Z" opacity=".85" />
          <circle cx="216" cy="40" r="1.5" opacity=".5" />
          <line x1="208" y1="64" x2="218" y2="54" strokeWidth=".75" opacity=".4" />
        </g>
        <g id="sparkle-2">
          <path d="M232 104Q232 116 244 116Q232 116 232 128Q232 116 220 116Q232 116 232 104Z" opacity=".75" />
          <circle cx="210" cy="95" r="1" opacity=".6" />
          <line x1="220" y1="116" x2="210" y2="95" strokeWidth=".75" opacity=".3" />
        </g>
        <g id="sparkle-3">
          <path d="M200 184Q200 194 210 194Q200 194 200 204Q200 194 190 194Q200 194 200 184Z" opacity=".8" />
          <circle cx="220" cy="170" r="1.5" opacity=".5" />
          <line x1="210" y1="194" x2="220" y2="170" strokeWidth=".75" opacity=".4" />
          <line x1="200" y1="194" x2="175" y2="215" strokeWidth=".75" opacity=".3" />
        </g>
        <g id="sparkle-4">
          <path d="M136 220Q136 230 146 230Q136 230 136 240Q136 230 126 230Q136 230 136 220Z" opacity=".7" />
          <circle cx="160" cy="225" r="1" opacity=".5" />
          <line x1="146" y1="230" x2="160" y2="225" strokeWidth=".75" opacity=".3" />
        </g>
        <g id="sparkle-5">
          <path d="M64 200Q64 210 74 210Q64 210 64 220Q64 210 54 210Q64 210 64 200Z" opacity=".85" />
          <circle cx="40" cy="225" r="1.5" opacity=".6" />
          <line x1="54" y1="210" x2="40" y2="225" strokeWidth=".75" opacity=".4" />
          <line x1="74" y1="210" x2="90" y2="210" strokeWidth=".75" opacity=".3" />
        </g>
        <g id="sparkle-6">
          <path d="M28 132Q28 142 38 142Q28 142 28 152Q28 142 18 142Q28 142 28 132Z" opacity=".8" />
          <circle cx="45" cy="165" r="1" opacity=".5" />
          <line x1="38" y1="142" x2="45" y2="165" strokeWidth=".75" opacity=".35" />
        </g>
        <g id="sparkle-7">
          <path d="M52 60Q52 72 64 72Q52 72 52 84Q52 72 40 72Q52 72 52 60Z" opacity=".75" />
          <circle cx="35" cy="45" r="1.5" opacity=".5" />
          <line x1="40" y1="72" x2="35" y2="45" strokeWidth=".75" opacity=".4" />
        </g>
        <g id="peripheral-constellation">
          <circle cx="155" cy="35" r="1.2" opacity=".6" />
          <circle cx="95" cy="28" r="1" opacity=".5" />
          <circle cx="25" cy="95" r="1.2" opacity=".5" />
          <circle cx="225" cy="150" r="1.5" opacity=".6" />
          <circle cx="105" cy="225" r="1.2" opacity=".5" />
          <circle cx="180" cy="215" r="1" opacity=".4" />
          <polyline points="155,35 192,48 208,64" fill="none" strokeWidth=".6" opacity=".35" />
          <polyline points="95,28 64,60 52,60" fill="none" strokeWidth=".6" opacity=".3" />
          <polyline points="25,95 28,132 45,165" fill="none" strokeWidth=".6" opacity=".35" />
          <polyline points="225,150 232,104 208,64" fill="none" strokeWidth=".6" opacity=".3" />
          <polyline points="105,225 136,220 180,215" fill="none" strokeWidth=".6" opacity=".3" />
        </g>
      </g>
    </svg>
  );
}

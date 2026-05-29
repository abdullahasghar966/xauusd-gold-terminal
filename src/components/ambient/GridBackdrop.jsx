/**
 * Subtle background grid plus a scan-line that sweeps top-to-bottom
 * every 8 seconds. SVG so it stays crisp at any resolution.
 */
export default function GridBackdrop() {
  return (
    <div
      aria-hidden="true"
      data-anim="grid"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.5,
      }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(201,168,76,0.05)" strokeWidth="1" />
          </pattern>
          <pattern id="grid-fine" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(201,168,76,0.025)" strokeWidth="1" />
          </pattern>
          <radialGradient id="mesh" cx="78%" cy="18%" r="60%">
            <stop offset="0%" stopColor="rgba(201,168,76,0.18)" />
            <stop offset="55%" stopColor="rgba(139,105,20,0.04)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(240,208,128,0)" />
            <stop offset="50%" stopColor="rgba(240,208,128,0.22)" />
            <stop offset="100%" stopColor="rgba(240,208,128,0)" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-fine)" />
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect width="100%" height="100%" fill="url(#mesh)" />
        <rect width="100%" height="160" fill="url(#scan)" opacity="0.0">
          <animate
            attributeName="y"
            from="-200"
            to="1400"
            dur="8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;0"
            dur="8s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>
    </div>
  );
}

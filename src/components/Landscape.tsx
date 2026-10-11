/** Misty mountain scene drawn in SVG, fading into the page color at the top. */
export function Landscape({ className = "", id = "scene" }: { className?: string; id?: string }) {
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden>
      <svg viewBox="0 0 1440 760" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eeeeeb" />
            <stop offset="0.35" stopColor="#e3e1d3" />
            <stop offset="1" stopColor="#cfcdb4" />
          </linearGradient>
          <radialGradient id={`${id}-sun`} cx="0.5" cy="0.42" r="0.4">
            <stop offset="0" stopColor="#fffbe6" stopOpacity="0.95" />
            <stop offset="1" stopColor="#fffbe6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-fog`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4f3ec" stopOpacity="0" />
            <stop offset="0.5" stopColor="#f4f3ec" stopOpacity="0.75" />
            <stop offset="1" stopColor="#f4f3ec" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eeeeeb" />
            <stop offset="1" stopColor="#eeeeeb" stopOpacity="0" />
          </linearGradient>
          <filter id={`${id}-soft`}>
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id={`${id}-soft-sm`}>
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>
        <rect width="1440" height="760" fill={`url(#${id}-sky)`} />
        <rect width="1440" height="760" fill={`url(#${id}-sun)`} />
        {/* Far peaks, hazy */}
        <path
          d="M0 300 L80 250 L150 270 L240 190 L320 240 L400 210 L480 150 L560 220 L640 200 L720 120 L800 190 L880 170 L960 230 L1040 160 L1120 210 L1200 180 L1280 240 L1360 200 L1440 230 V760 H0Z"
          fill="#cbcbb8"
          filter={`url(#${id}-soft)`}
        />
        <rect y="200" width="1440" height="150" fill={`url(#${id}-fog)`} />
        {/* Mid ridges */}
        <path
          d="M0 360 L100 300 L180 330 L280 260 L360 310 L460 270 L540 320 L640 280 L740 230 L820 290 L900 260 L1000 310 L1100 250 L1200 300 L1300 270 L1440 320 V760 H0Z"
          fill="#a9ae8f"
          filter={`url(#${id}-soft-sm)`}
        />
        <rect y="290" width="1440" height="140" fill={`url(#${id}-fog)`} />
        {/* Rolling hills */}
        <path d="M0 450 C 160 400 300 390 440 420 S 680 380 820 420 S 1080 380 1220 410 S 1380 400 1440 410 V760 H0Z" fill="#828d69" />
        <rect y="410" width="1440" height="100" fill={`url(#${id}-fog)`} opacity="0.7" />
        <path d="M0 550 C 180 500 320 490 460 520 S 720 480 880 520 S 1160 490 1300 510 S 1400 505 1440 515 V760 H0Z" fill="#5b6742" />
        <path d="M0 650 C 200 610 380 600 560 630 S 900 600 1080 625 S 1340 610 1440 620 V760 H0Z" fill="#3c4630" />
        <rect width="1440" height="180" fill={`url(#${id}-fade)`} />
      </svg>
    </div>
  );
}

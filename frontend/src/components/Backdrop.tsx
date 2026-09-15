// Fixed, full-page decorative background — ported directly from the
// imported design. Rendered once at the app root so every screen sits on
// top of it.
export function Backdrop() {
  return (
    <svg
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      width="100%"
      height="100%"
      viewBox="0 0 1600 900"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      preserveAspectRatio="none"
    >
      <path d="M0 0h420C340 120 160 170 0 150z" fill="#0d1440" opacity="0.75" />
      <path d="M1600 0v260c-180 40-330-30-430-90-70-42-60-130 20-170z" fill="#0d1440" opacity="0.6" />
      <path d="M0 640c260-70 520 60 760 20 260-44 520-120 840-60v300H0z" fill="#0a1136" opacity="0.8" />
      <path
        d="M1180 470c120-50 260-20 320 60 60 80-20 170-140 170s-240-60-240-140c0-40 20-70 60-90z"
        fill="#0c1240"
        opacity="0.5"
      />
      <g stroke="#8b5cf6" strokeWidth="3.2" opacity="0.75" style={{ filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.7))' }}>
        <path d="M60 420l10-10M54 432l11 10M76 444l10 10" />
        <path d="M120 690c-9-9-4-20 5-16 4-9 16-7 16 4 0 9-11 18-21 23-10-5-21-14-21-23 0-11 12-13 16-4" />
        <path d="M1500 360l22 18-22 19-22-19z" />
        <path d="M1450 700l18 14-18 15-18-15z" />
        <path d="M40 820l16-46 14 8-16 46-16 7z" />
        <path d="M1540 560c8-9 16-9 24 0" />
        <path d="M90 250c8-9 16-9 24 0" />
      </g>
      <g stroke="#38bdf8" strokeWidth="3.2" opacity="0.6" style={{ filter: 'drop-shadow(0 0 8px rgba(56,189,248,0.6))' }}>
        <path d="M1560 440l-14 8M1548 470l-16 4" />
        <path d="M36 560l14 8M28 594l16 2" />
        <path d="M1520 830l-12-14" />
      </g>
    </svg>
  );
}

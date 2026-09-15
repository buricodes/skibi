// The "sketch" mascot illustration from the imported design's Doodle.dc.html
// (a kid drawing a house) — only this variant is used, on the Home hero card.
export function Doodle() {
  return (
    <svg
      viewBox="0 0 220 150"
      width="100%"
      height="100%"
      style={{ display: 'block' }}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g stroke="#6cc5f5" strokeWidth="2.6">
        <path d="M26 20l-7 15" />
        <path d="M46 14l-7 15" />
        <path d="M66 22l-7 15" />
        <path d="M36 36l-6 13" />
      </g>
      <circle cx="170" cy="30" r="10" fill="#f8d84b" />
      <g stroke="#f8d84b" strokeWidth="2.6">
        <path d="M170 13V6" />
        <path d="M185 30h7" />
        <path d="M181 19l5-5" />
        <path d="M181 41l5 5" />
        <path d="M159 19l-5-5" />
      </g>
      <g stroke="#17181f" strokeWidth="3" fill="none">
        <circle cx="66" cy="74" r="14" />
        <circle cx="61" cy="71" r="1.6" fill="#17181f" />
        <circle cx="71" cy="71" r="1.6" fill="#17181f" />
        <path d="M60 79c4 4 8 4 12 0" />
        <path d="M66 88v30" />
        <path d="M66 118l-9 16M66 118l9 16" />
        <path d="M66 96l-14 10" />
      </g>
      <path d="M66 96l22-8" stroke="#3b82f6" strokeWidth="5" fill="none" />
      <path d="M110 84l22-19 22 19" fill="none" stroke="#ef4f7f" strokeWidth="5" />
      <path d="M115 84v38h34V84" fill="none" stroke="#17181f" strokeWidth="3" />
      <path d="M126 122V99h12v23" fill="none" stroke="#17181f" strokeWidth="3" />
      <g stroke="#2fb457" strokeWidth="3">
        <path d="M92 134c3-6 5-8 6-12" />
        <path d="M104 135c2-7 3-9 3-13" />
        <path d="M158 134c3-6 5-8 6-12" />
        <path d="M170 135c2-7 3-9 3-13" />
        <path d="M44 136c3-6 5-8 6-12" />
      </g>
    </svg>
  );
}

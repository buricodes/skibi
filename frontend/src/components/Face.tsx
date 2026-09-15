// Simple colored-circle avatar, ported directly from the design's Face.dc.html.
export function Face({ color, size = 32 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'block', flex: 'none' }}>
      <circle cx="12" cy="12" r="12" fill={color} />
      <circle cx="8.2" cy="10" r="1.5" fill="#16113a" />
      <circle cx="15.8" cy="10" r="1.5" fill="#16113a" />
      <path d="M7.6 14.2c1.5 2.6 7.3 2.6 8.8 0" stroke="#16113a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

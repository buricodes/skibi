// A deterministic color per player, cycling through the same palette the
// imported design used for its avatars — keyed by join order so it's
// stable across renders without needing to store anything server-side.
const PALETTE = ['#8b7ff0', '#f27aa0', '#7ddc7d', '#f5d94e', '#b28ae0', '#4fd6c0', '#ff9f6b', '#6bc8f2'];

export function playerColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

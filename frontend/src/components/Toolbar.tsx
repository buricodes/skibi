export type DrawTool = 'pen' | 'marker' | 'eraser';

const PALETTE = [
  '#14161f',
  '#ffffff',
  '#e8453c',
  '#f97316',
  '#fb923c',
  '#facc15',
  '#22c55e',
  '#4ade80',
  '#3b82f6',
  '#93b4fd',
  '#e879f9',
  '#f472b6',
];

// Matches the imported design 1:1 — brush sizes per tool (pen 7, marker 18,
// eraser 34) so Draw.tsx can derive the actual stroke size from `tool`.
export const TOOL_SIZES: Record<DrawTool, number> = { pen: 7, marker: 18, eraser: 34 };

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-[#3a2f8f]' : 'bg-panel-2'}`}
    >
      {children}
    </button>
  );
}

export function Toolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  onUndo,
  onClear,
}: {
  tool: DrawTool;
  onToolChange: (t: DrawTool) => void;
  color: string;
  onColorChange: (c: string) => void;
  onUndo: () => void;
  onClear: () => void;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl bg-panel p-3.5 shadow-[0_0_0_1.5px_var(--color-ring)]">
      <div className="flex flex-col gap-2">
        <ToolButton active={tool === 'pen'} onClick={() => onToolChange('pen')} title="Pencil">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dfe4ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3l4 4-11 11-5 1 1-5z" />
          </svg>
        </ToolButton>
        <ToolButton active={tool === 'eraser'} onClick={() => onToolChange('eraser')} title="Eraser">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dfe4ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 17l9-9 5 5-9 9H8z" />
            <path d="M4 21h9" />
          </svg>
        </ToolButton>
        <ToolButton active={tool === 'marker'} onClick={() => onToolChange('marker')} title="Marker">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dfe4ff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16l5-6 4 4 7-8" />
          </svg>
        </ToolButton>
        <ToolButton active={false} onClick={onUndo} title="Undo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dfe4ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 7L4 12l5 5" />
            <path d="M4 12h9a6 6 0 010 12h-2" />
          </svg>
        </ToolButton>
        <ToolButton active={false} onClick={onClear} title="Clear">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />
          </svg>
        </ToolButton>
      </div>
      <div className="grid grid-cols-2 content-start justify-items-center gap-2.5">
        {PALETTE.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onColorChange(hex)}
            aria-label={`color ${hex}`}
            className="h-[30px] w-[30px] rounded-full"
            style={{ background: hex, boxShadow: color === hex ? '0 0 0 3px #a855f7' : '0 0 0 1.5px #2b3568' }}
          />
        ))}
      </div>
    </div>
  );
}

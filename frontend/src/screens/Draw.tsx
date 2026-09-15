import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@/components/Canvas';
import type { CanvasHandle } from '@/components/Canvas';
import { Chat } from '@/components/Chat';
import { GameHeader } from '@/components/GameHeader';
import { PlayerList } from '@/components/PlayerList';
import { Toolbar, TOOL_SIZES } from '@/components/Toolbar';
import type { DrawTool } from '@/components/Toolbar';
import { socket } from '@/lib/socket';
import { TYPE_CANVAS_CLEAR, TYPE_STROKE_END, TYPE_STROKE_POINT, TYPE_STROKE_START } from '@/lib/types';
import type { StrokePoint, StrokeStart } from '@/lib/types';
import { useGame } from '@/state/GameContext';

// Handles both the Choosing and Drawing phases in one screen — the word
// picker/waiting message appears right where the canvas will be, in the
// same layout, instead of a separate full-screen interstitial.
export function Draw() {
  const {
    room,
    self,
    isDrawer,
    wordChoices,
    yourWord,
    chooseWord,
    sendChat,
    sendStrokeStart,
    sendStrokePoint,
    sendStrokeEnd,
    sendCanvasClear,
  } = useGame();
  const canvasRef = useRef<CanvasHandle>(null);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState('#e8453c');

  const isChoosing = room?.phase === 'choosing';

  // Guessers only: replay whatever the current drawer broadcasts. The
  // drawer doesn't subscribe to these — they ARE the source, their own
  // Canvas already rendered their strokes locally as they drew them.
  useEffect(() => {
    if (isDrawer) return;
    const offs = [
      socket.on<StrokeStart>(TYPE_STROKE_START, (s) => canvasRef.current?.applyRemoteStrokeStart(s)),
      socket.on<StrokePoint>(TYPE_STROKE_POINT, (p) => canvasRef.current?.applyRemoteStrokePoint(p)),
      socket.on(TYPE_STROKE_END, () => canvasRef.current?.applyRemoteStrokeEnd()),
      socket.on(TYPE_CANVAS_CLEAR, () => canvasRef.current?.applyRemoteClear()),
    ];
    return () => offs.forEach((off) => off());
  }, [isDrawer]);

  if (!room) return null;

  const drawer = room.players.find((p) => p.id === room.drawerId);
  const effectiveColor = tool === 'eraser' ? '#ffffff' : color;
  const effectiveSize = TOOL_SIZES[tool];
  const blanks = Array.from({ length: room.wordLength ?? 0 })
    .map(() => '_')
    .join(' ');

  return (
    <div className="relative z-1 mx-auto max-w-[1240px] px-6 py-6">
      <GameHeader phaseLabel={isChoosing ? 'Choosing' : 'Drawing'} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,340px)]">
        <div className="flex flex-col gap-4">
          <PlayerList
            players={room.players}
            hostId={room.hostId}
            selfId={self?.playerId ?? null}
            drawerId={room.drawerId}
            scores={room.scores}
          />
          {!isChoosing && isDrawer && (
            <Toolbar
              tool={tool}
              onToolChange={setTool}
              color={color}
              onColorChange={setColor}
              onUndo={() => canvasRef.current?.undo()}
              onClear={() => canvasRef.current?.clear()}
            />
          )}
        </div>

        <div
          className="rounded-2xl shadow-[0_0_0_1.5px_var(--color-ring),0_14px_40px_rgba(0,0,0,0.4)]"
          style={{
            background: isChoosing ? 'var(--color-panel)' : '#fff',
            padding: isChoosing ? 0 : 10,
            minHeight: 380,
            display: 'flex',
            alignItems: isChoosing ? 'center' : undefined,
            justifyContent: isChoosing ? 'center' : undefined,
          }}
        >
          {isChoosing ? (
            isDrawer && wordChoices ? (
              <div className="flex flex-col items-center gap-5 px-8 py-12 text-center">
                <h2 className="font-display text-2xl font-extrabold text-white">Pick a word to draw</h2>
                <div className="flex flex-wrap justify-center gap-3">
                  {wordChoices.map((w) => (
                    <button
                      key={w}
                      onClick={() => chooseWord(w)}
                      className="rounded-2xl bg-panel-2 px-6 py-3.5 text-lg font-extrabold transition hover:bg-[#3a2f8f]"
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-8 py-12 text-center">
                <h2 className="font-display text-2xl font-extrabold text-white">
                  {drawer?.nickname ?? 'Someone'} is choosing a word…
                </h2>
                <p className="text-muted-2">Get ready to guess!</p>
              </div>
            )
          ) : (
            <Canvas
              ref={canvasRef}
              interactive={isDrawer}
              color={effectiveColor}
              size={effectiveSize}
              onStrokeStart={sendStrokeStart}
              onStrokePoint={sendStrokePoint}
              onStrokeEnd={sendStrokeEnd}
              onClear={sendCanvasClear}
            />
          )}
        </div>

        <div className="flex h-[500px] flex-col gap-3 lg:h-[640px]">
          {!isChoosing && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-panel-2 px-4 py-3 shadow-[0_0_0_1.5px_#3a2f7a]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.4" strokeLinecap="round" className="flex-none">
                <path d="M17 3l4 4-11 11-5 1 1-5z" />
              </svg>
              {isDrawer ? (
                <span className="text-sm font-bold text-[#c9d0f0]">
                  Your word: <span className="font-extrabold text-white">{yourWord}</span>
                </span>
              ) : (
                <span className="font-mono text-sm font-bold tracking-widest text-white">{blanks}</span>
              )}
            </div>
          )}
          <div className="flex-1">
            <Chat
              messages={room.chat}
              players={room.players}
              selfId={self?.playerId ?? null}
              onSend={sendChat}
              placeholder={isDrawer && !isChoosing ? 'Chat…' : 'Type your guess…'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
